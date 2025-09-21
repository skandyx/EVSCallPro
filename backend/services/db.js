-- backend/services/db.js
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Helper function to convert snake_case keys from DB to camelCase for the API
const keysToCamel = (obj) => {
    // Correctly handle null, undefined, and arrays before processing.
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(v => keysToCamel(v));
    }
    const newObj = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            newObj[camelKey] = keysToCamel(obj[key]);
        }
    }
    return newObj;
};

// Helper to ensure JSON fields are parsed correctly from the DB
const parseJsonFields = (rows, fields) => {
    return rows.map(row => {
        const newRow = { ...row };
        fields.forEach(field => {
            // Check if the field exists and is a string (JSONB can sometimes be returned as an object already)
            if (newRow[field] && typeof newRow[field] === 'string') {
                try {
                    newRow[field] = JSON.parse(newRow[field]);
                } catch (e) {
                    console.error(`Error parsing JSON for field ${field} in row with id ${newRow.id}:`, e);
                    // Assign a default value or handle the error as needed
                    newRow[field] = (field === 'pages' || field === 'nodes' || field === 'connections') ? [] : {};
                }
            }
        });
        return newRow;
    });
};

async function getAllApplicationData() {
    // This function will fetch all necessary data for the application's initial load.
    // It's a placeholder and should be implemented to fetch from all relevant tables.
    const [
        users, userGroups, campaigns, savedScripts, ivrFlows,
        qualifications, qualificationGroups, trunks, dids, sites,
        audioFiles, planningEvents,
        // The following are more for reporting/supervision, might not be needed on initial load
        // callHistory, agentSessions, personalCallbacks
    ] = await Promise.all([
        getUsers(),
        getUserGroups(),
        getCampaigns(),
        getScripts(),
        getIvrFlows(),
        getQualifications(),
        getQualificationGroups(),
        getTrunks(),
        getDids(),
        getSites(),
        getAudioFiles(),
        getPlanningEvents(),
    ]);

    return {
        users,
        userGroups,
        campaigns,
        savedScripts,
        ivrFlows,
        qualifications,
        qualificationGroups,
        trunks,
        dids,
        sites,
        audioFiles,
        planningEvents,
        // Add other data sets as needed
    };
}


// --- DATA FETCHERS ---

async function getUsers() {
    const res = await pool.query('SELECT id, login_id, first_name, last_name, email, role, is_active, site_id FROM users ORDER BY first_name, last_name');
    return keysToCamel(res.rows);
}

async function getUserGroups() {
    const res = await pool.query('SELECT * FROM user_groups ORDER BY name');
    const groups = keysToCamel(res.rows);
    const membersRes = await pool.query('SELECT * FROM user_group_members');
    groups.forEach(g => {
        g.memberIds = membersRes.rows.filter(m => m.group_id === g.id).map(m => m.user_id);
    });
    return groups;
}

async function getCampaigns() {
    const res = await pool.query('SELECT * FROM campaigns ORDER BY name');
    const campaigns = keysToCamel(res.rows);
    const contactsRes = await pool.query('SELECT * FROM contacts');
    const agentsRes = await pool.query('SELECT * FROM campaign_agents');
    campaigns.forEach(c => {
        c.contacts = keysToCamel(contactsRes.rows.filter(co => co.campaign_id === c.id));
        c.assignedUserIds = agentsRes.rows.filter(a => a.campaign_id === c.id).map(a => a.user_id);
    });
    return campaigns;
}

async function getScripts() {
    const res = await pool.query('SELECT * FROM scripts ORDER BY name');
    return keysToCamel(parseJsonFields(res.rows, ['pages']));
}

async function getIvrFlows() {
    const res = await pool.query('SELECT * FROM ivr_flows ORDER BY name');
    return keysToCamel(parseJsonFields(res.rows, ['nodes', 'connections']));
}

async function getQualifications() {
    const res = await pool.query('SELECT * FROM qualifications ORDER BY code');
    return keysToCamel(res.rows);
}

async function getQualificationGroups() {
    const res = await pool.query('SELECT * FROM qualification_groups ORDER BY name');
    return keysToCamel(res.rows);
}

async function getTrunks() {
    const res = await pool.query('SELECT id, name, domain, login, auth_type, dial_pattern, inbound_context, force_caller_id FROM trunks ORDER BY name');
    return keysToCamel(res.rows);
}

async function getDids() {
    const res = await pool.query('SELECT * FROM dids ORDER BY number');
    return keysToCamel(res.rows);
}

async function getSites() {
    const res = await pool.query('SELECT id, name, yeastar_ip, api_user FROM sites ORDER BY name');
    return keysToCamel(res.rows);
}

async function getAudioFiles() {
    const res = await pool.query('SELECT * FROM audio_files ORDER BY name');
    return keysToCamel(res.rows);
}

async function getPlanningEvents() {
    const res = await pool.query('SELECT * FROM planning_events');
    return keysToCamel(res.rows);
}

async function getIvrFlowByDnid(dnid) {
    const res = await pool.query('SELECT f.* FROM ivr_flows f JOIN dids d ON f.id = d.ivr_flow_id WHERE d.number = $1 LIMIT 1', [dnid]);
    if (res.rows.length > 0) {
        return keysToCamel(parseJsonFields(res.rows, ['nodes', 'connections'])[0]);
    }
    return null;
}

// --- DATA SAVERS ---

async function authenticateUser(loginId, password) {
    // WARNING: Storing and comparing plain text passwords is a major security risk.
    // This should be replaced with a password hashing library like bcrypt in production.
    const res = await pool.query(
        'SELECT id, login_id, first_name, last_name, email, role, is_active, site_id FROM users WHERE login_id = $1 AND password_hash = $2', 
        [loginId, password]
    );
    return res.rows.length > 0 ? keysToCamel(res.rows[0]) : null;
}

async function createUser(user, groupIds = []) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const userRes = await client.query(
            `INSERT INTO users (id, login_id, first_name, last_name, email, "role", is_active, password_hash, site_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, login_id, first_name, last_name, email, "role", is_active, site_id`,
            [user.id, user.loginId, user.firstName, user.lastName, user.email || null, user.role, user.isActive, user.password, user.siteId || null]
        );
        const newUser = userRes.rows[0];

        if (groupIds.length > 0) {
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
        newUser.campaignIds = user.campaignIds || [];
        return keysToCamel(newUser);
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function updateUser(userId, user, groupIds = []) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Build the UPDATE query dynamically to avoid overwriting the password
        const updates = {
            login_id: user.loginId,
            first_name: user.firstName,
            last_name: user.lastName,
            email: user.email || null,
            "role": user.role,
            is_active: user.isActive,
            site_id: user.siteId || null
        };

        // Only add password to the update if it's provided and not empty
        if (user.password && user.password.length > 0) {
            updates.password_hash = user.password;
        }

        const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 1}`).join(', ');
        const values = Object.values(updates);

        const userRes = await client.query(
            `UPDATE users SET ${setClauses}, updated_at = NOW()
             WHERE id = $${values.length + 1}
             RETURNING id, login_id, first_name, last_name, email, "role", is_active, site_id`,
            [...values, userId]
        );
        const updatedUser = userRes.rows[0];
        
        if (!updatedUser) {
            throw new Error(`User with id ${userId} not found.`);
        }

        await client.query('DELETE FROM user_group_members WHERE user_id = $1', [userId]);
        if (groupIds && groupIds.length > 0) {
            for (const groupId of groupIds) {
                await client.query('INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)', [userId, groupId]);
            }
        }

        await client.query('DELETE FROM campaign_agents WHERE user_id = $1', [userId]);
        if (user.campaignIds && user.campaignIds.length > 0) {
             for (const campaignId of user.campaignIds) {
                 await client.query('INSERT INTO campaign_agents (user_id, campaign_id) VALUES ($1, $2)', [userId, campaignId]);
            }
        }

        await client.query('COMMIT');
        updatedUser.campaignIds = user.campaignIds || [];
        return keysToCamel(updatedUser);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error in updateUser transaction:", e);
        throw e;
    } finally {
        client.release();
    }
}


async function deleteUser(userId) {
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

async function saveUserGroup(group, id = null) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let savedGroup;
        if (id) {
            const res = await client.query('UPDATE user_groups SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [group.name, id]);
            savedGroup = res.rows[0];
        } else {
            const res = await client.query('INSERT INTO user_groups (id, name) VALUES ($1, $2) RETURNING *', [group.id, group.name]);
            savedGroup = res.rows[0];
        }
        await client.query('DELETE FROM user_group_members WHERE group_id = $1', [savedGroup.id]);
        if (group.memberIds && group.memberIds.length > 0) {
            for (const memberId of group.memberIds) {
                await client.query('INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)', [memberId, savedGroup.id]);
            }
        }
        await client.query('COMMIT');
        savedGroup.memberIds = group.memberIds || [];
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

async function saveCampaign(campaign, id = null) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let savedCampaign;
        const { name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime } = campaign;
        const queryParams = [name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime];

        if (id) {
            const res = await client.query(
                `UPDATE campaigns SET name = $1, description = $2, script_id = $3, qualification_group_id = $4, caller_id = $5, is_active = $6, dialing_mode = $7, wrap_up_time = $8, updated_at = NOW() 
                 WHERE id = $9 RETURNING *`,
                [...queryParams, id]
            );
            savedCampaign = res.rows[0];
        } else {
            const res = await client.query(
                `INSERT INTO campaigns (name, description, script_id, qualification_group_id, caller_id, is_active, dialing_mode, wrap_up_time, id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [...queryParams, campaign.id]
            );
            savedCampaign = res.rows[0];
        }

        await client.query('DELETE FROM campaign_agents WHERE campaign_id = $1', [savedCampaign.id]);
        if (campaign.assignedUserIds && campaign.assignedUserIds.length > 0) {
            for (const userId of campaign.assignedUserIds) {
                await client.query('INSERT INTO campaign_agents (campaign_id, user_id) VALUES ($1, $2)', [savedCampaign.id, userId]);
            }
        }
        await client.query('COMMIT');
        savedCampaign.assignedUserIds = campaign.assignedUserIds || [];
        return keysToCamel(savedCampaign);
    } catch (e) {
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
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const contact of contacts) {
            await client.query(
                `INSERT INTO contacts (id, campaign_id, first_name, last_name, phone_number, postal_code, status, custom_fields)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [contact.id, campaignId, contact.firstName, contact.lastName, contact.phoneNumber, contact.postalCode, 'pending', JSON.stringify(contact.customFields || {})]
            );
        }
        await client.query('COMMIT');
        return { message: 'Contacts imported successfully' };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function saveScript(script, id = null) {
    const pagesJson = JSON.stringify(script.pages);
    if (id) {
        const res = await pool.query(
            `UPDATE scripts SET name = $1, pages = $2, start_page_id = $3, background_color = $4, updated_at = NOW()
             WHERE id = $5 RETURNING *`,
            [script.name, pagesJson, script.startPageId, script.backgroundColor, id]
        );
        return keysToCamel(parseJsonFields(res.rows, ['pages'])[0]);
    }
    const res = await pool.query(
        `INSERT INTO scripts (id, name, pages, start_page_id, background_color)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [script.id, script.name, pagesJson, script.startPageId, script.backgroundColor]
    );
    return keysToCamel(parseJsonFields(res.rows, ['pages'])[0]);
}

async function deleteScript(scriptId) {
    await pool.query('DELETE FROM scripts WHERE id = $1', [scriptId]);
}

async function duplicateScript(scriptId) {
    const originalRes = await pool.query('SELECT * FROM scripts WHERE id = $1', [scriptId]);
    if (originalRes.rows.length === 0) throw new Error('Script not found');
    const original = originalRes.rows[0];
    const newScript = {
        ...original,
        id: `script-${Date.now()}`,
        name: `${original.name} (Copie)`,
    };
    return saveScript(newScript);
}

async function saveIvrFlow(flow, id = null) {
    const nodesJson = JSON.stringify(flow.nodes);
    const connectionsJson = JSON.stringify(flow.connections);
    if (id) {
        const res = await pool.query(
            `UPDATE ivr_flows SET name = $1, nodes = $2, connections = $3, updated_at = NOW()
             WHERE id = $4 RETURNING *`,
            [flow.name, nodesJson, connectionsJson, id]
        );
        return keysToCamel(parseJsonFields(res.rows, ['nodes', 'connections'])[0]);
    }
    const res = await pool.query(
        `INSERT INTO ivr_flows (id, name, nodes, connections)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [flow.id, flow.name, nodesJson, connectionsJson]
    );
    return keysToCamel(parseJsonFields(res.rows, ['nodes', 'connections'])[0]);
}

async function deleteIvrFlow(flowId) {
    await pool.query('DELETE FROM ivr_flows WHERE id = $1', [flowId]);
}

async function duplicateIvrFlow(flowId) {
    const originalRes = await pool.query('SELECT * FROM ivr_flows WHERE id = $1', [flowId]);
    if (originalRes.rows.length === 0) throw new Error('IVR Flow not found');
    const original = originalRes.rows[0];
    const newFlow = {
        ...original,
        id: `ivr-flow-${Date.now()}`,
        name: `${original.name} (Copie)`,
    };
    return saveIvrFlow(newFlow);
}


async function saveQualification(qual, id = null) {
    const { code, description, type, parentId } = qual;
    if (id) {
        const res = await pool.query(
            `UPDATE qualifications SET code = $1, description = $2, type = $3, parent_id = $4, updated_at = NOW() WHERE id = $5 AND is_standard = false RETURNING *`,
            [code, description, type, parentId || null, id]
        );
        return keysToCamel(res.rows[0]);
    }
    const res = await pool.query(
        `INSERT INTO qualifications (id, code, description, type, parent_id, is_standard) VALUES ($1, $2, $3, $4, $5, false) RETURNING *`,
        [qual.id, code, description, type, parentId || null]
    );
    return keysToCamel(res.rows[0]);
}

async function deleteQualification(qualId) {
    await pool.query('DELETE FROM qualifications WHERE id = $1 AND is_standard = false', [qualId]);
}

async function saveQualificationGroup(group, assignedQualIds = [], id = null) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let savedGroup;
        if (id) {
            const res = await client.query('UPDATE qualification_groups SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [group.name, id]);
            savedGroup = res.rows[0];
        } else {
            const res = await client.query('INSERT INTO qualification_groups (id, name) VALUES ($1, $2) RETURNING *', [group.id, group.name]);
            savedGroup = res.rows[0];
        }

        await client.query('UPDATE qualifications SET group_id = NULL WHERE group_id = $1', [savedGroup.id]);
        if (assignedQualIds.length > 0) {
            const placeholders = assignedQualIds.map((_, i) => `$${i + 2}`).join(',');
            await client.query(`UPDATE qualifications SET group_id = $1 WHERE id IN (${placeholders})`, [savedGroup.id, ...assignedQualIds]);
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

async function deleteQualificationGroup(groupId) {
    await pool.query('DELETE FROM qualification_groups WHERE id = $1', [groupId]);
}

async function saveGeneric(table, data, id = null) {
    const keys = Object.keys(data).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at' && k !== 'password' || (k === 'password' && data[k]));
    const columns = keys.map(k => k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`));
    
    if (id) {
        const setString = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
        const values = keys.map(key => data[key]);
        const res = await pool.query(`UPDATE ${table} SET ${setString}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`, [...values, id]);
        return keysToCamel(res.rows[0]);
    }
    const allColumns = ['id', ...columns];
    const placeholders = allColumns.map((_, i) => `$${i + 1}`).join(',');
    const values = [data.id, ...keys.map(key => data[key])];
    const res = await pool.query(`INSERT INTO ${table} (${allColumns.join(',')}) VALUES (${placeholders}) RETURNING *`, values);
    return keysToCamel(res.rows[0]);
}

async function deleteGeneric(table, id) {
     await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

module.exports = {
    getAllApplicationData,
    authenticateUser,
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    getUserGroups,
    saveUserGroup,
    deleteUserGroup,
    getCampaigns,
    saveCampaign,
    deleteCampaign,
    importContacts,
    getScripts,
    saveScript,
    deleteScript,
    duplicateScript,
    getIvrFlows,
    saveIvrFlow,
    deleteIvrFlow,
    duplicateIvrFlow,
    getQualifications,
    saveQualification,
    deleteQualification,
    getQualificationGroups,
    saveQualificationGroup,
    deleteQualificationGroup,
    getTrunks,
    saveTrunk: (data, id) => saveGeneric('trunks', data, id),
    deleteTrunk: (id) => deleteGeneric('trunks', id),
    getDids,
    saveDid: (data, id) => saveGeneric('dids', data, id),
    deleteDid: (id) => deleteGeneric('dids', id),
    getSites,
    saveSite: (data, id) => saveGeneric('sites', data, id),
    deleteSite: (id) => deleteGeneric('sites', id),
    getAudioFiles,
    saveAudioFile: (data, id) => saveGeneric('audio_files', data, id),
    deleteAudioFile: (id) => deleteGeneric('audio_files', id),
    getPlanningEvents,
    savePlanningEvent: (data, id) => saveGeneric('planning_events', data, id),
    deletePlanningEvent: (id) => deleteGeneric('planning_events', id),
    getIvrFlowByDnid,
};