require('dotenv').config();
const { Pool } = require('pg');

// --- DATABASE CONNECTION POOL ---
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// --- HELPER FUNCTIONS ---
const keysToCamel = (obj) => {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj;
    }
    // Check if it's a plain object to avoid trying to convert class instances, etc.
    if (obj.constructor !== Object) {
        return obj;
    }
    const newObj = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            newObj[camelKey] = obj[key];
        }
    }
    return newObj;
};

const arrayToCamel = (arr) => {
    if (!Array.isArray(arr)) {
        return arr;
    }
    return arr.map(item => keysToCamel(item));
};

// --- CORE FUNCTIONS ---

const authenticateUser = async (loginId, password) => {
    // In a real app, password should be compared against a hash using bcrypt.
    // For this project, we are comparing plain text as per the current setup.
    const res = await pool.query('SELECT * FROM users WHERE login_id = $1 AND password_hash = $2', [loginId, password]);
    if (res.rows.length > 0) {
        const user = keysToCamel(res.rows[0]);
        // We don't want to send the hash back to the client
        delete user.passwordHash;
        
        // Fetch assigned campaign IDs
        const campaignRes = await pool.query('SELECT campaign_id FROM campaign_agents WHERE user_id = $1', [user.id]);
        user.campaignIds = campaignRes.rows.map(r => r.campaign_id);
        
        return user;
    }
    return null;
};

const getAllApplicationData = async () => {
    const client = await pool.connect();
    try {
        const [
            usersRes, groupsRes, campaignsRes, scriptsRes, ivrFlowsRes,
            qualificationsRes, qualGroupsRes, trunksRes, didsRes, sitesRes,
            audioFilesRes, planningEventsRes, callbacksRes, historyRes, sessionsRes
        ] = await Promise.all([
            client.query('SELECT id, login_id, first_name, last_name, email, role, is_active, site_id FROM users'),
            client.query('SELECT * FROM user_groups'),
            client.query('SELECT * FROM campaigns'),
            client.query('SELECT * FROM scripts'),
            client.query('SELECT * FROM ivr_flows'),
            client.query('SELECT * FROM qualifications'),
            client.query('SELECT * FROM qualification_groups'),
            client.query('SELECT id, name, domain, login, auth_type, register_string, dial_pattern, inbound_context, force_caller_id FROM trunks'),
            client.query('SELECT * FROM dids'),
            client.query('SELECT id, name, yeastar_ip, api_user FROM sites'),
            client.query('SELECT * FROM audio_files'),
            client.query('SELECT * FROM planning_events'),
            client.query('SELECT * FROM personal_callbacks'),
            client.query('SELECT * FROM call_history ORDER BY timestamp DESC LIMIT 100'),
            client.query('SELECT * FROM agent_sessions ORDER BY login_time DESC LIMIT 100'),
            // Fetch join tables
            client.query('SELECT * FROM user_group_members'),
            client.query('SELECT * FROM campaign_agents'),
            client.query('SELECT * FROM contacts'),
        ]);

        const users = arrayToCamel(usersRes.rows);
        const userGroups = arrayToCamel(groupsRes.rows);
        const campaigns = arrayToCamel(campaignsRes.rows);

        // Map join table data
        const groupMembers = groupsRes.rows.length > 0 ? await client.query('SELECT * FROM user_group_members') : { rows: [] };
        userGroups.forEach(g => {
            g.memberIds = groupMembers.rows.filter(m => m.group_id === g.id).map(m => m.user_id);
        });

        const campaignAgents = campaignsRes.rows.length > 0 ? await client.query('SELECT * FROM campaign_agents') : { rows: [] };
        users.forEach(u => {
            u.campaignIds = campaignAgents.rows.filter(m => m.user_id === u.id).map(m => m.campaign_id);
        });
        
        const contactsData = contactsRes.rows.length > 0 ? await client.query('SELECT * FROM contacts') : { rows: [] };
        campaigns.forEach(c => {
            c.assignedUserIds = campaignAgents.rows.filter(m => m.campaign_id === c.id).map(m => m.user_id);
            c.contacts = arrayToCamel(contactsData.rows.filter(contact => contact.campaign_id === c.id));
        });

        return {
            users,
            userGroups,
            campaigns,
            savedScripts: arrayToCamel(scriptsRes.rows),
            savedIvrFlows: arrayToCamel(ivrFlowsRes.rows),
            qualifications: arrayToCamel(qualificationsRes.rows),
            qualificationGroups: arrayToCamel(qualGroupsRes.rows),
            trunks: arrayToCamel(trunksRes.rows),
            dids: arrayToCamel(didsRes.rows),
            sites: arrayToCamel(sitesRes.rows),
            audioFiles: arrayToCamel(audioFilesRes.rows),
            planningEvents: arrayToCamel(planningEventsRes.rows),
            personalCallbacks: arrayToCamel(callbacksRes.rows),
            callHistory: arrayToCamel(historyRes.rows),
            agentSessions: arrayToCamel(sessionsRes.rows),
        };
    } finally {
        client.release();
    }
};

const createUser = async (user, groupIds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const res = await client.query(
            'INSERT INTO users (id, login_id, first_name, last_name, email, role, is_active, password_hash, site_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [user.id, user.loginId, user.firstName, user.lastName, user.email || null, user.role, user.isActive, user.password, user.siteId]
        );
        const newUser = keysToCamel(res.rows[0]);

        if (groupIds && groupIds.length > 0) {
            for (const groupId of groupIds) {
                await client.query('INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)', [newUser.id, groupId]);
            }
        }
        
        if (user.campaignIds && user.campaignIds.length > 0) {
            for (const campaignId of user.campaignIds) {
                await client.query('INSERT INTO campaign_agents (user_id, campaign_id) VALUES ($1, $2)', [newUser.id, campaignId]);
            }
        }

        await client.query('COMMIT');
        delete newUser.passwordHash;
        return newUser;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const updateUser = async (id, user, groupIds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const res = await client.query(
            'UPDATE users SET login_id = $1, first_name = $2, last_name = $3, email = $4, role = $5, is_active = $6, password_hash = $7, site_id = $8, updated_at = NOW() WHERE id = $9 RETURNING *',
            [user.loginId, user.firstName, user.lastName, user.email || null, user.role, user.isActive, user.password, user.siteId, id]
        );
        const updatedUser = keysToCamel(res.rows[0]);

        await client.query('DELETE FROM user_group_members WHERE user_id = $1', [id]);
        if (groupIds && groupIds.length > 0) {
            for (const groupId of groupIds) {
                await client.query('INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)', [id, groupId]);
            }
        }
        
        await client.query('DELETE FROM campaign_agents WHERE user_id = $1', [id]);
        if (user.campaignIds && user.campaignIds.length > 0) {
            for (const campaignId of user.campaignIds) {
                await client.query('INSERT INTO campaign_agents (user_id, campaign_id) VALUES ($1, $2)', [id, campaignId]);
            }
        }

        await client.query('COMMIT');
        delete updatedUser.passwordHash;
        return updatedUser;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const deleteUser = (id) => pool.query('DELETE FROM users WHERE id = $1', [id]);

const saveUserGroup = async (group) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let res;
        if (group.id.startsWith('group-')) { // Existing
            res = await client.query('UPDATE user_groups SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [group.name, group.id]);
        } else {
            res = await client.query('INSERT INTO user_groups (id, name) VALUES ($1, $2) RETURNING *', [group.id, group.name]);
        }
        const savedGroup = keysToCamel(res.rows[0]);
        await client.query('DELETE FROM user_group_members WHERE group_id = $1', [savedGroup.id]);
        if (group.memberIds && group.memberIds.length > 0) {
            for (const memberId of group.memberIds) {
                await client.query('INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)', [memberId, savedGroup.id]);
            }
        }
        await client.query('COMMIT');
        return savedGroup;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const deleteUserGroup = (id) => pool.query('DELETE FROM user_groups WHERE id = $1', [id]);

const saveScript = async (script, id = null) => {
    if (id) {
        const res = await pool.query('UPDATE scripts SET name = $1, pages = $2, start_page_id = $3, background_color = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
            [script.name, JSON.stringify(script.pages), script.startPageId, script.backgroundColor, id]);
        return keysToCamel(res.rows[0]);
    } else {
        const res = await pool.query('INSERT INTO scripts (id, name, pages, start_page_id, background_color) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [script.id, script.name, JSON.stringify(script.pages), script.startPageId, script.backgroundColor]);
        return keysToCamel(res.rows[0]);
    }
};

const deleteScript = (id) => pool.query('DELETE FROM scripts WHERE id = $1', [id]);

const saveQualificationGroup = async (group, assignedQualIds, id = null) => {
     const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let savedGroup;
        if (id) {
            const res = await client.query('UPDATE qualification_groups SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [group.name, id]);
            savedGroup = keysToCamel(res.rows[0]);
        } else {
            const res = await client.query('INSERT INTO qualification_groups (id, name) VALUES ($1, $2) RETURNING *', [group.id, group.name]);
            savedGroup = keysToCamel(res.rows[0]);
        }
        // Unassign all quals from this group first
        await client.query('UPDATE qualifications SET group_id = NULL WHERE group_id = $1', [savedGroup.id]);
        // Then assign the selected ones
        if (assignedQualIds && assignedQualIds.length > 0) {
            await client.query('UPDATE qualifications SET group_id = $1 WHERE id = ANY($2::text[])', [savedGroup.id, assignedQualIds]);
        }
        await client.query('COMMIT');
        return savedGroup;
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const deleteQualificationGroup = (id) => pool.query('DELETE FROM qualification_groups WHERE id = $1', [id]);

const getIvrFlowByDnid = async (dnid) => {
    const res = await pool.query(
        'SELECT f.* FROM ivr_flows f JOIN dids d ON f.id = d.ivr_flow_id WHERE d.number = $1',
        [dnid]
    );
    return res.rows.length > 0 ? keysToCamel(res.rows[0]) : null;
};

// Add other functions from previous fixes...
const saveCampaign = async (campaign, id = null) => {
    const { assignedUserIds, ...campaignData } = campaign;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let savedCampaign;
        if (id) {
            const res = await client.query(
                `UPDATE campaigns SET name=$1, description=$2, script_id=$3, qualification_group_id=$4, caller_id=$5, is_active=$6, dialing_mode=$7, wrap_up_time=$8, updated_at=NOW() WHERE id=$9 RETURNING *`,
                [campaignData.name, campaignData.description, campaignData.scriptId, campaignData.qualificationGroupId, campaignData.callerId, campaignData.isActive, campaignData.dialingMode, campaignData.wrapUpTime, id]
            );
            savedCampaign = keysToCamel(res.rows[0]);
        } else {
            const res = await client.query(
                `INSERT INTO campaigns (id, name, description, script_id, qualification_group_id, caller_id, is_active, dialing_mode, wrap_up_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [campaignData.id, campaignData.name, campaignData.description, campaignData.scriptId, campaignData.qualificationGroupId, campaignData.callerId, campaignData.isActive, campaignData.dialingMode, campaignData.wrapUpTime]
            );
            savedCampaign = keysToCamel(res.rows[0]);
        }
        
        await client.query('DELETE FROM campaign_agents WHERE campaign_id = $1', [savedCampaign.id]);
        if (assignedUserIds && assignedUserIds.length > 0) {
            for (const userId of assignedUserIds) {
                await client.query('INSERT INTO campaign_agents (campaign_id, user_id) VALUES ($1, $2)', [savedCampaign.id, userId]);
            }
        }
        
        await client.query('COMMIT');
        return savedCampaign;
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};
const deleteCampaign = (id) => pool.query('DELETE FROM campaigns WHERE id = $1', [id]);
const importContacts = async (campaignId, contacts) => {
     const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const contact of contacts) {
            await client.query(
                'INSERT INTO contacts (id, campaign_id, first_name, last_name, phone_number, postal_code, status, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [contact.id, campaignId, contact.firstName, contact.lastName, contact.phoneNumber, contact.postalCode, 'pending', JSON.stringify(contact.customFields || {})]
            );
        }
        await client.query('COMMIT');
        return { message: `${contacts.length} contacts imported.` };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};
const saveIvrFlow = async (flow, id = null) => {
    if (id) {
        const res = await pool.query('UPDATE ivr_flows SET name=$1, nodes=$2, connections=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
            [flow.name, JSON.stringify(flow.nodes), JSON.stringify(flow.connections), id]);
        return keysToCamel(res.rows[0]);
    } else {
        const res = await pool.query('INSERT INTO ivr_flows (id, name, nodes, connections) VALUES ($1, $2, $3, $4) RETURNING *',
            [flow.id, flow.name, JSON.stringify(flow.nodes), JSON.stringify(flow.connections)]);
        return keysToCamel(res.rows[0]);
    }
};
const deleteIvrFlow = (id) => pool.query('DELETE FROM ivr_flows WHERE id=$1', [id]);
const saveQualification = async (qual, id = null) => {
     if (id) {
        const res = await pool.query('UPDATE qualifications SET code=$1, description=$2, type=$3, parent_id=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
            [qual.code, qual.description, qual.type, qual.parentId, id]);
        return keysToCamel(res.rows[0]);
    } else {
        const res = await pool.query('INSERT INTO qualifications (id, code, description, type, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [qual.id, qual.code, qual.description, qual.type, qual.parentId]);
        return keysToCamel(res.rows[0]);
    }
};
const deleteQualification = (id) => pool.query('DELETE FROM qualifications WHERE id=$1', [id]);

module.exports = {
    authenticateUser,
    getAllApplicationData,
    createUser,
    updateUser,
    deleteUser,
    saveUserGroup,
    deleteUserGroup,
    saveCampaign,
    deleteCampaign,
    importContacts,
    saveScript,
    deleteScript,
    saveIvrFlow,
    deleteIvrFlow,
    saveQualification,
    deleteQualification,
    saveQualificationGroup,
    deleteQualificationGroup,
    getIvrFlowByDnid
    // Other exports will be added as they are implemented
};
