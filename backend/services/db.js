
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// --- UTILITY FUNCTIONS ---

// Converts snake_case keys from the DB to camelCase for the frontend.
const keysToCamel = (obj) => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(v => keysToCamel(v));
    }
    return Object.keys(obj).reduce((acc, key) => {
        const camelKey = key.replace(/([-_][a-z])/ig, ($1) => {
            return $1.toUpperCase().replace('-', '').replace('_', '');
        });
        // Recursively convert keys for nested objects, but not for JSONB content like 'pages' or 'nodes'
        if (typeof obj[key] === 'object' && obj[key] !== null && !['pages', 'nodes', 'connections', 'customFields'].includes(key)) {
             acc[camelKey] = keysToCamel(obj[key]);
        } else {
            acc[camelKey] = obj[key];
        }
        return acc;
    }, {});
};

// Converts camelCase keys from the frontend to snake_case for the DB.
const keysToSnake = (obj) => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(v => keysToSnake(v));
    }
    return Object.keys(obj).reduce((acc, key) => {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        acc[snakeKey] = obj[key];
        return acc;
    }, {});
};

const parseJsonFields = (items, fields) => {
    return items.map(item => {
        const newItem = { ...item };
        fields.forEach(field => {
            if (typeof newItem[field] === 'string') {
                try {
                    newItem[field] = JSON.parse(newItem[field]);
                } catch (e) {
                    console.error(`Failed to parse JSON for field ${field} in item ${item.id}:`, e);
                    // Keep it as a string or set to a default value if parsing fails
                }
            }
        });
        return newItem;
    });
};


// --- DATA ACCESS FUNCTIONS ---

async function getAllApplicationData() {
    const client = await pool.connect();
    try {
        const [
            usersRes,
            userGroupsRes,
            campaignsRes,
            scriptsRes,
            ivrFlowsRes,
            qualificationsRes,
            qualificationGroupsRes,
            trunksRes,
            didsRes,
            sitesRes,
            audioFilesRes,
            planningEventsRes
        ] = await Promise.all([
            client.query('SELECT * FROM users ORDER BY first_name'),
            client.query('SELECT * FROM user_groups ORDER BY name'),
            client.query('SELECT c.*, array_agg(ca.user_id) FILTER (WHERE ca.user_id IS NOT NULL) as assigned_user_ids FROM campaigns c LEFT JOIN campaign_agents ca ON c.id = ca.campaign_id GROUP BY c.id ORDER BY name'),
            client.query('SELECT * FROM scripts ORDER BY name'),
            client.query('SELECT * FROM ivr_flows ORDER BY name'),
            client.query('SELECT * FROM qualifications ORDER BY code'),
            client.query('SELECT * FROM qualification_groups ORDER BY name'),
            client.query('SELECT * FROM trunks ORDER BY name'),
            client.query('SELECT * FROM dids ORDER BY number'),
            client.query('SELECT * FROM sites ORDER BY name'),
            client.query('SELECT * FROM audio_files ORDER BY name'),
            client.query('SELECT * FROM planning_events')
            // Add other tables as needed
        ]);
        
        // Populate campaignIds for each user
        const campaignAssignments = await client.query('SELECT user_id, campaign_id FROM campaign_agents');
        const userCampaignsMap = campaignAssignments.rows.reduce((acc, row) => {
            if (!acc[row.user_id]) acc[row.user_id] = [];
            acc[row.user_id].push(row.campaign_id);
            return acc;
        }, {});
        
        const users = usersRes.rows.map(u => ({ ...u, campaign_ids: userCampaignsMap[u.id] || [] }));
        
        // Populate memberIds for each group
        const groupAssignments = await client.query('SELECT user_id, group_id FROM user_group_members');
        const groupMembersMap = groupAssignments.rows.reduce((acc, row) => {
            if (!acc[row.group_id]) acc[row.group_id] = [];
            acc[row.group_id].push(row.user_id);
            return acc;
        }, {});

        const userGroups = userGroupsRes.rows.map(g => ({ ...g, member_ids: groupMembersMap[g.id] || [] }));

        // Correctly parse JSON fields
        const scripts = parseJsonFields(scriptsRes.rows, ['pages']);
        const ivrFlows = parseJsonFields(ivrFlowsRes.rows, ['nodes', 'connections']);

        return keysToCamel({
            users,
            userGroups,
            campaigns: campaignsRes.rows,
            savedScripts: scripts,
            savedIvrFlows: ivrFlows,
            qualifications: qualificationsRes.rows,
            qualificationGroups: qualificationGroupsRes.rows,
            trunks: trunksRes.rows,
            dids: didsRes.rows,
            sites: sitesRes.rows,
            audioFiles: audioFilesRes.rows,
            planningEvents: planningEventsRes.rows,
            // Add other mock data placeholders here if needed for frontend compatibility
            personalCallbacks: [],
            systemConnectionSettings: {},
            backupSchedule: {},
            backupLogs: [],
            callHistory: [],
            agentSessions: [],
            systemLogs: [],
            versionInfo: {},
            connectivityServices: [],
            activityTypes: [],
        });

    } finally {
        client.release();
    }
}

async function authenticateUser(loginId, password) {
    // In a real app, use bcrypt.compare(password, user.password_hash)
    const { rows } = await pool.query(
        'SELECT * FROM users WHERE login_id = $1 AND password_hash = $2 AND is_active = TRUE',
        [loginId, password]
    );
    if (rows.length > 0) {
        return keysToCamel(rows[0]);
    }
    return null;
}

// --- Users ---
async function createUser(user, groupIds) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Step 1: Create the user
        const userQuery = `
            INSERT INTO users (id, login_id, first_name, last_name, email, "role", is_active, password_hash, site_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *;
        `;
        const userValues = [
            user.id, user.loginId, user.firstName, user.lastName, user.email || null,
            user.role, user.isActive, user.password, user.siteId || null
        ];
        const { rows: createdUserRows } = await client.query(userQuery, userValues);
        const newUser = createdUserRows[0];

        // Step 2: Assign to groups if provided
        if (groupIds && groupIds.length > 0) {
            const groupValues = groupIds.map(groupId => `('${newUser.id}', '${groupId}')`).join(',');
            await client.query(`INSERT INTO user_group_members (user_id, group_id) VALUES ${groupValues}`);
        }

        // Step 3: Assign to campaigns if provided
        if (user.campaignIds && user.campaignIds.length > 0) {
            const campaignValues = user.campaignIds.map(campaignId => `('${campaignId}', '${newUser.id}')`).join(',');
            await client.query(`INSERT INTO campaign_agents (campaign_id, user_id) VALUES ${campaignValues}`);
        }
        
        await client.query('COMMIT');
        return keysToCamel(newUser);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error in createUser:", e);
        throw e;
    } finally {
        client.release();
    }
}


async function updateUser(userId, user, groupIds) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const updateFields = {};
        const queryParams = [];
        let paramIndex = 1;

        // Dynamically build the SET clause for the user update
        const userFieldsToUpdate = ['firstName', 'lastName', 'email', 'role', 'isActive', 'siteId', 'password'];
        userFieldsToUpdate.forEach(field => {
            if (user[field] !== undefined) {
                 // CRITICAL: Only update password if a new one is provided and not empty
                if (field === 'password') {
                    if (user.password && user.password.trim() !== '') {
                        updateFields.password_hash = user.password;
                    }
                } else {
                    const snakeField = keysToSnake({[field]:''}); // get snake_case version of the key
                    updateFields[Object.keys(snakeField)[0]] = user[field];
                }
            }
        });
        
        const setClauses = Object.keys(updateFields).map(key => {
            queryParams.push(updateFields[key]);
            return `${key} = $${paramIndex++}`;
        });

        // Only run the UPDATE query if there are fields to update in the users table
        if (setClauses.length > 0) {
            queryParams.push(userId);
            const updateUserQuery = `UPDATE users SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`;
            await client.query(updateUserQuery, queryParams);
        }

        // Update group memberships (always rewrite them)
        await client.query('DELETE FROM user_group_members WHERE user_id = $1', [userId]);
        if (groupIds && groupIds.length > 0) {
            const groupValues = groupIds.map(groupId => `('${userId}', '${groupId}')`).join(',');
            await client.query(`INSERT INTO user_group_members (user_id, group_id) VALUES ${groupValues}`);
        }
        
        // Update campaign assignments (always rewrite them)
        await client.query('DELETE FROM campaign_agents WHERE user_id = $1', [userId]);
        if (user.campaignIds && user.campaignIds.length > 0) {
            const campaignValues = user.campaignIds.map(campaignId => `('${campaignId}', '${userId}')`).join(',');
            await client.query(`INSERT INTO campaign_agents (campaign_id, user_id) VALUES ${campaignValues}`);
        }

        await client.query('COMMIT');

        const { rows } = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
        return keysToCamel(rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error in updateUser:", e);
        throw e;
    } finally {
        client.release();
    }
}


async function deleteUser(userId) {
    // The ON DELETE CASCADE constraint will handle memberships
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

// --- Groups ---
async function saveUserGroup(group, groupId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let savedGroup;
        if (groupId) {
            // Update
            const { rows } = await client.query(
                'UPDATE user_groups SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
                [group.name, groupId]
            );
            savedGroup = rows[0];
        } else {
            // Create
            const { rows } = await client.query(
                'INSERT INTO user_groups (id, name) VALUES ($1, $2) RETURNING *',
                [group.id, group.name]
            );
            savedGroup = rows[0];
        }
        
        // Update members
        await client.query('DELETE FROM user_group_members WHERE group_id = $1', [savedGroup.id]);
        if (group.memberIds && group.memberIds.length > 0) {
            const memberValues = group.memberIds.map(userId => `('${userId}', '${savedGroup.id}')`).join(',');
            await client.query(`INSERT INTO user_group_members (user_id, group_id) VALUES ${memberValues}`);
        }

        await client.query('COMMIT');
        return keysToCamel(savedGroup);
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function deleteUserGroup(groupId) {
    await pool.query('DELETE FROM user_groups WHERE id = $1', [groupId]);
}

// --- Scripts ---
async function saveScript(script, scriptId) {
    const { name, pages, startPageId, backgroundColor } = script;
    if (scriptId) {
        const { rows } = await pool.query(
            'UPDATE scripts SET name = $1, pages = $2, start_page_id = $3, background_color = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
            [name, JSON.stringify(pages), startPageId, backgroundColor, scriptId]
        );
        return keysToCamel(parseJsonFields(rows, ['pages'])[0]);
    } else {
        const { rows } = await pool.query(
            'INSERT INTO scripts (id, name, pages, start_page_id, background_color) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [script.id, name, JSON.stringify(pages), startPageId, backgroundColor]
        );
        return keysToCamel(parseJsonFields(rows, ['pages'])[0]);
    }
}

async function deleteScript(scriptId) {
    await pool.query('DELETE FROM scripts WHERE id = $1', [scriptId]);
}

async function duplicateScript(scriptId) {
    const { rows } = await pool.query('SELECT * FROM scripts WHERE id = $1', [scriptId]);
    if (rows.length === 0) throw new Error('Script not found');
    const script = rows[0];
    script.id = `script-${Date.now()}`;
    script.name = `${script.name} (Copie)`;
    return saveScript(keysToCamel(script));
}


// --- Campaigns ---
async function saveCampaign(campaign, campaignId) {
    const { name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, assignedUserIds } = campaign;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let savedCampaign;
        if (campaignId) {
            const { rows } = await client.query(
                'UPDATE campaigns SET name=$1, description=$2, script_id=$3, qualification_group_id=$4, caller_id=$5, is_active=$6, dialing_mode=$7, wrap_up_time=$8, updated_at=NOW() WHERE id=$9 RETURNING *',
                [name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, campaignId]
            );
            savedCampaign = rows[0];
        } else {
            const { rows } = await client.query(
                'INSERT INTO campaigns (id, name, description, script_id, qualification_group_id, caller_id, is_active, dialing_mode, wrap_up_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
                [campaign.id, name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime]
            );
            savedCampaign = rows[0];
        }

        await client.query('DELETE FROM campaign_agents WHERE campaign_id = $1', [savedCampaign.id]);
        if (assignedUserIds && assignedUserIds.length > 0) {
            const agentValues = assignedUserIds.map(userId => `('${savedCampaign.id}', '${userId}')`).join(',');
            await client.query(`INSERT INTO campaign_agents (campaign_id, user_id) VALUES ${agentValues}`);
        }

        await client.query('COMMIT');
        return keysToCamel(savedCampaign);
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function deleteCampaign(campaignId) {
    await pool.query('DELETE FROM campaigns WHERE id = $1', [campaignId]);
}

async function importContacts(campaignId, contacts) {
    if (contacts.length === 0) return { imported: 0 };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const values = contacts.map(c => `('${c.id}', '${campaignId}', '${c.firstName}', '${c.lastName}', '${c.phoneNumber}', '${c.postalCode || ''}', '${JSON.stringify(c.customFields || {})}')`).join(',');
        const query = `INSERT INTO contacts (id, campaign_id, first_name, last_name, phone_number, postal_code, custom_fields) VALUES ${values}`;
        await client.query(query);
        await client.query('COMMIT');
        return { imported: contacts.length };
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}


// --- IVR Flows ---
async function getIvrFlowByDnid(dnid) {
    const { rows } = await pool.query('SELECT ivr_flow_id FROM dids WHERE number = $1', [dnid]);
    if (rows.length === 0 || !rows[0].ivr_flow_id) return null;
    const { rows: flowRows } = await pool.query('SELECT * FROM ivr_flows WHERE id = $1', [rows[0].ivr_flow_id]);
    if (flowRows.length === 0) return null;
    const parsedFlow = parseJsonFields(flowRows, ['nodes', 'connections']);
    return keysToCamel(parsedFlow[0]);
}

async function saveIvrFlow(flow, flowId) {
     const { name, nodes, connections } = flow;
    if (flowId) {
        const { rows } = await pool.query(
            'UPDATE ivr_flows SET name = $1, nodes = $2, connections = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
            [name, JSON.stringify(nodes), JSON.stringify(connections), flowId]
        );
        return keysToCamel(parseJsonFields(rows, ['nodes', 'connections'])[0]);
    } else {
        const { rows } = await pool.query(
            'INSERT INTO ivr_flows (id, name, nodes, connections) VALUES ($1, $2, $3, $4) RETURNING *',
            [flow.id, name, JSON.stringify(nodes), JSON.stringify(connections)]
        );
        return keysToCamel(parseJsonFields(rows, ['nodes', 'connections'])[0]);
    }
}

async function deleteIvrFlow(flowId) {
    await pool.query('DELETE FROM ivr_flows WHERE id = $1', [flowId]);
}

async function duplicateIvrFlow(flowId) {
     const { rows } = await pool.query('SELECT * FROM ivr_flows WHERE id = $1', [flowId]);
    if (rows.length === 0) throw new Error('IVR Flow not found');
    const flow = rows[0];
    flow.id = `ivr-flow-${Date.now()}`;
    flow.name = `${flow.name} (Copie)`;
    const parsedFlow = parseJsonFields([flow], ['nodes', 'connections']);
    return saveIvrFlow(keysToCamel(parsedFlow[0]));
}


// --- Qualifications ---
async function saveQualificationGroup(group, assignedQualIds, groupId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let savedGroup;
        if(groupId) {
            const { rows } = await client.query('UPDATE qualification_groups SET name=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [group.name, groupId]);
            savedGroup = rows[0];
        } else {
            const { rows } = await client.query('INSERT INTO qualification_groups (id, name) VALUES ($1, $2) RETURNING *', [group.id, group.name]);
            savedGroup = rows[0];
        }
        
        await client.query('UPDATE qualifications SET group_id = NULL WHERE group_id = $1', [savedGroup.id]);
        if (assignedQualIds && assignedQualIds.length > 0) {
            await client.query('UPDATE qualifications SET group_id = $1 WHERE id = ANY($2::text[])', [savedGroup.id, assignedQualIds]);
        }
        
        await client.query('COMMIT');
        return keysToCamel(savedGroup);
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function deleteQualificationGroup(groupId) {
    await pool.query('DELETE FROM qualification_groups WHERE id = $1', [groupId]);
}

// ... Add other functions for dids, trunks, sites etc. following the same pattern

module.exports = {
    getAllApplicationData,
    authenticateUser,
    createUser,
    updateUser,
    deleteUser,
    saveUserGroup,
    deleteUserGroup,
    saveScript,
    deleteScript,
    duplicateScript,
    saveCampaign,
    deleteCampaign,
    importContacts,
    getIvrFlowByDnid,
    saveIvrFlow,
    deleteIvrFlow,
    duplicateIvrFlow,
    saveQualificationGroup,
    deleteQualificationGroup,
    // placeholders for functions that are in server.js but not fully implemented here
    getUsers: async () => keysToCamel((await pool.query('SELECT * FROM users')).rows),
    getUserGroups: async () => keysToCamel((await pool.query('SELECT * FROM user_groups')).rows),
    getCampaigns: async () => keysToCamel((await pool.query('SELECT * FROM campaigns')).rows),
    getScripts: async () => keysToCamel(parseJsonFields((await pool.query('SELECT * FROM scripts')).rows, ['pages'])),
    getIvrFlows: async () => keysToCamel(parseJsonFields((await pool.query('SELECT * FROM ivr_flows')).rows, ['nodes', 'connections'])),
    getQualifications: async () => keysToCamel((await pool.query('SELECT * FROM qualifications')).rows),
    getQualificationGroups: async () => keysToCamel((await pool.query('SELECT * FROM qualification_groups')).rows),
    getTrunks: async () => keysToCamel((await pool.query('SELECT * FROM trunks')).rows),
    getDids: async () => keysToCamel((await pool.query('SELECT * FROM dids')).rows),
    getSites: async () => keysToCamel((await pool.query('SELECT * FROM sites')).rows),
    getAudioFiles: async () => keysToCamel((await pool.query('SELECT * FROM audio_files')).rows),
    getPlanningEvents: async () => keysToCamel((await pool.query('SELECT * FROM planning_events')).rows),
    saveQualification: async (qual, id) => {
        if (id) {
            const { rows } = await pool.query('UPDATE qualifications SET code=$1, description=$2, type=$3, parent_id=$4, updated_at=NOW() WHERE id=$5 RETURNING *', [qual.code, qual.description, qual.type, qual.parentId, id]);
            return keysToCamel(rows[0]);
        }
        const { rows } = await pool.query('INSERT INTO qualifications (id, code, description, type, parent_id, is_standard) VALUES ($1, $2, $3, $4, $5, false) RETURNING *', [qual.id, qual.code, qual.description, qual.type, qual.parentId]);
        return keysToCamel(rows[0]);
    },
    deleteQualification: async (id) => await pool.query('DELETE FROM qualifications WHERE id=$1', [id]),
    saveTrunk: async (trunk, id) => { /* ... implementation ... */ return keysToCamel(trunk); },
    deleteTrunk: async (id) => { /* ... implementation ... */ },
    saveDid: async (did, id) => { /* ... implementation ... */ return keysToCamel(did); },
    deleteDid: async (id) => { /* ... implementation ... */ },
    saveSite: async (site, id) => { /* ... implementation ... */ return keysToCamel(site); },
    deleteSite: async (id) => { /* ... implementation ... */ },
    saveAudioFile: async (file, id) => { /* ... implementation ... */ return keysToCamel(file); },
    deleteAudioFile: async (id) => { /* ... implementation ... */ },
    savePlanningEvent: async (event, id) => { /* ... implementation ... */ return keysToCamel(event); },
    deletePlanningEvent: async (id) => { /* ... implementation ... */ },
};
