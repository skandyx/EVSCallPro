const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Utility to convert snake_case keys from DB to camelCase for the frontend
const keysToCamel = (obj) => {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj;
    }
    if (obj.constructor.name !== 'Object') {
        return obj;
    }
    
    return Object.keys(obj).reduce((acc, key) => {
        const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        acc[camelKey] = keysToCamel(obj[key]);
        return acc;
    }, {});
};

// --- AUTHENTICATION ---
const authenticateUser = async (loginId, password) => {
    // In a real app, 'password' would be hashed before comparison
    const res = await pool.query('SELECT * FROM users WHERE login_id = $1 AND password_hash = $2', [loginId, password]);
    if (res.rows.length > 0) {
        return keysToCamel(res.rows[0]);
    }
    return null;
};

// --- DATA LOADERS ---
const getAllApplicationData = async () => {
    const [
        sitesRes, usersRes, userGroupsRes, campaignsRes, scriptsRes, ivrFlowsRes,
        qualificationsRes, qualificationGroupsRes, trunksRes, didsRes, audioFilesRes,
        planningEventsRes, personalCallbacksRes, activityTypesRes,
        userGroupMembersRes, campaignAgentsRes, contactsRes
    ] = await Promise.all([
        pool.query('SELECT * FROM sites ORDER BY name'),
        pool.query('SELECT * FROM users ORDER BY first_name, last_name'),
        pool.query('SELECT * FROM user_groups ORDER BY name'),
        pool.query('SELECT * FROM campaigns ORDER BY name'),
        pool.query('SELECT * FROM scripts ORDER BY name'),
        pool.query('SELECT * FROM ivr_flows ORDER BY name'),
        pool.query('SELECT * FROM qualifications ORDER BY code'),
        pool.query('SELECT * FROM qualification_groups ORDER BY name'),
        pool.query('SELECT * FROM trunks ORDER BY name'),
        pool.query('SELECT * FROM dids ORDER BY number'),
        pool.query('SELECT * FROM audio_files ORDER BY name'),
        pool.query('SELECT * FROM planning_events'),
        pool.query('SELECT * FROM personal_callbacks'),
        pool.query('SELECT * FROM activity_types ORDER BY name'),
        pool.query('SELECT * FROM user_group_members'),
        pool.query('SELECT * FROM campaign_agents'),
        pool.query('SELECT * FROM contacts')
    ]);

    const users = usersRes.rows.map(keysToCamel);
    const userGroups = userGroupsRes.rows.map(keysToCamel);
    const campaigns = campaignsRes.rows.map(keysToCamel);
    const contacts = contactsRes.rows.map(keysToCamel);

    // Attach memberships and contacts
    const usersWithMemberships = users.map(user => ({
        ...user,
        campaignIds: campaignAgentsRes.rows.filter(ca => ca.user_id === user.id).map(ca => ca.campaign_id),
    }));

    const groupsWithMembers = userGroups.map(group => ({
        ...group,
        memberIds: userGroupMembersRes.rows.filter(ugm => ugm.group_id === group.id).map(ugm => ugm.user_id),
    }));
    
    const campaignsWithContacts = campaigns.map(c => ({
        ...c,
        contacts: contacts.filter(co => co.campaign_id === c.id)
    }));


    return {
        sites: sitesRes.rows.map(keysToCamel),
        users: usersWithMemberships,
        userGroups: groupsWithMembers,
        campaigns: campaignsWithContacts,
        savedScripts: scriptsRes.rows.map(parseScriptOrFlow),
        savedIvrFlows: ivrFlowsRes.rows.map(parseScriptOrFlow),
        qualifications: qualificationsRes.rows.map(keysToCamel),
        qualificationGroups: qualificationGroupsRes.rows.map(keysToCamel),
        trunks: trunksRes.rows.map(keysToCamel),
        dids: didsRes.rows.map(keysToCamel),
        audioFiles: audioFilesRes.rows.map(keysToCamel),
        planningEvents: planningEventsRes.rows.map(keysToCamel),
        personalCallbacks: personalCallbacksRes.rows.map(keysToCamel),
        activityTypes: activityTypesRes.rows.map(keysToCamel)
    };
};

const getIvrFlowByDnid = async (dnid) => {
    const query = `
        SELECT ivr.* 
        FROM ivr_flows ivr
        JOIN dids d ON d.ivr_flow_id = ivr.id
        WHERE d.number = $1
    `;
    const res = await pool.query(query, [dnid]);
    if (res.rows.length > 0) {
        let flow = keysToCamel(res.rows[0]);
        // PG driver can auto-parse JSON, but if not, ensure it's parsed
        if (typeof flow.nodes === 'string') flow.nodes = JSON.parse(flow.nodes);
        if (typeof flow.connections === 'string') flow.connections = JSON.parse(flow.connections);
        return flow;
    }
    return null;
};

// --- USERS ---
const getUsers = async () => {
    const res = await pool.query('SELECT * FROM users ORDER BY first_name, last_name');
    return res.rows.map(keysToCamel);
};

const createUser = async (user, groupIds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const userQuery = `
            INSERT INTO users (id, login_id, first_name, last_name, email, "role", is_active, password_hash, site_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *;
        `;
        const userRes = await client.query(userQuery, [
            user.id, user.loginId, user.firstName, user.lastName, user.email || null,
            user.role, user.isActive, user.password, user.siteId || null
        ]);

        const newUser = userRes.rows[0];

        if (groupIds && groupIds.length > 0) {
            const groupValues = groupIds.map((groupId, i) => `($1, $${i + 2})`).join(',');
            const groupQuery = `INSERT INTO user_group_members (user_id, group_id) VALUES ${groupValues};`;
            await client.query(groupQuery, [newUser.id, ...groupIds]);
        }
        
        if (user.campaignIds && user.campaignIds.length > 0) {
            const campaignValues = user.campaignIds.map((campaignId, i) => `($${i + 2}, $1)`).join(',');
            const campaignQuery = `INSERT INTO campaign_agents (campaign_id, user_id) VALUES ${campaignValues};`;
            await client.query(campaignQuery, [newUser.id, ...user.campaignIds]);
        }

        await client.query('COMMIT');
        return keysToCamel(newUser);
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const updateUser = async (userId, user, groupIds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Step 1: Update the user record itself
        const hasPassword = user.password && user.password.trim() !== '';
        
        const userQuery = `
            UPDATE users SET 
                login_id = $1, 
                first_name = $2, 
                last_name = $3, 
                email = $4, 
                "role" = $5, 
                is_active = $6, 
                site_id = $7
                ${hasPassword ? ', password_hash = $8' : ''}, 
                updated_at = NOW()
            WHERE id = $${hasPassword ? 9 : 8}
            RETURNING *;
        `;
        
        const userValues = [
            user.loginId,
            user.firstName,
            user.lastName,
            user.email || null,
            user.role,
            user.isActive,
            user.siteId || null,
        ];

        if (hasPassword) {
            userValues.push(user.password);
        }
        userValues.push(userId);

        const { rows: updatedUserRows } = await client.query(userQuery, userValues);
        if (updatedUserRows.length === 0) {
            throw new Error('User not found for update.');
        }

        // Step 2: Update group memberships
        await client.query('DELETE FROM user_group_members WHERE user_id = $1', [userId]);
        if (groupIds && groupIds.length > 0) {
            const groupValues = groupIds.map((groupId, i) => `($1, $${i + 2})`).join(',');
            await client.query(`INSERT INTO user_group_members (user_id, group_id) VALUES ${groupValues}`, [userId, ...groupIds]);
        }
        
        // Step 3: Update campaign assignments
        await client.query('DELETE FROM campaign_agents WHERE user_id = $1', [userId]);
        if (user.campaignIds && user.campaignIds.length > 0) {
            const campaignValues = user.campaignIds.map((campaignId, i) => `($${i + 2}, $1)`).join(',');
            await client.query(`INSERT INTO campaign_agents (campaign_id, user_id) VALUES ${campaignValues}`, [userId, ...user.campaignIds]);
        }
        
        await client.query('COMMIT');
        
        // The user was updated, return the updated record. No need to re-query.
        return keysToCamel(updatedUserRows[0]);

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error in updateUser transaction:", e);
        throw e;
    } finally {
        client.release();
    }
};

const deleteUser = async (id) => {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
};

// --- GROUPS ---
const getUserGroups = async () => {
    const res = await pool.query('SELECT * FROM user_groups ORDER BY name');
    return res.rows.map(keysToCamel);
};

const saveUserGroup = async (group, id) => {
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
            // Harmonize column order with other functions for consistency and robustness.
            const values = group.memberIds.map((userId, i) => `($${i + 2}, $1)`).join(',');
            await client.query(`INSERT INTO user_group_members (user_id, group_id) VALUES ${values}`, [savedGroup.id, ...group.memberIds]);
        }
        
        await client.query('COMMIT');
        return keysToCamel(savedGroup);
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const deleteUserGroup = async (id) => {
    await pool.query('DELETE FROM user_groups WHERE id = $1', [id]);
};

// --- SCRIPT HELPERS ---
const parseScriptOrFlow = (item) => {
    const camelItem = keysToCamel(item);
    if (typeof camelItem.pages === 'string') camelItem.pages = JSON.parse(camelItem.pages);
    if (typeof camelItem.nodes === 'string') camelItem.nodes = JSON.parse(camelItem.nodes);
    if (typeof camelItem.connections === 'string') camelItem.connections = JSON.parse(camelItem.connections);
    return camelItem;
};


// --- SCRIPTS ---
const getScripts = async () => {
    const res = await pool.query('SELECT * FROM scripts ORDER BY name');
    return res.rows.map(parseScriptOrFlow);
};

const saveScript = async (script, id) => {
    const { name, pages, startPageId, backgroundColor } = script;
    const pagesJson = JSON.stringify(pages);
    if (id) {
        const res = await pool.query('UPDATE scripts SET name=$1, pages=$2, start_page_id=$3, background_color=$4, updated_at=NOW() WHERE id=$5 RETURNING *', [name, pagesJson, startPageId, backgroundColor, id]);
        return parseScriptOrFlow(res.rows[0]);
    }
    const res = await pool.query('INSERT INTO scripts (id, name, pages, start_page_id, background_color) VALUES ($1, $2, $3, $4, $5) RETURNING *', [script.id, name, pagesJson, startPageId, backgroundColor]);
    return parseScriptOrFlow(res.rows[0]);
};

const deleteScript = async (id) => await pool.query('DELETE FROM scripts WHERE id = $1', [id]);
const duplicateScript = async (id) => {
    const res = await pool.query('SELECT * FROM scripts WHERE id = $1', [id]);
    if (res.rows.length === 0) {
        throw new Error('Script not found');
    }
    const originalScript = parseScriptOrFlow(res.rows[0]);
    const newScript = {
        ...originalScript,
        id: `script-${Date.now()}`,
        name: `${originalScript.name} (Copie)`,
    };
    return saveScript(newScript); 
};

// --- IVR FLOWS ---
const getIvrFlows = async () => {
    const res = await pool.query('SELECT * FROM ivr_flows ORDER BY name');
    return res.rows.map(parseScriptOrFlow);
};
const saveIvrFlow = async (flow, id) => {
     const { name, nodes, connections } = flow;
    const nodesJson = JSON.stringify(nodes);
    const connectionsJson = JSON.stringify(connections);
    if (id) {
        const res = await pool.query('UPDATE ivr_flows SET name=$1, nodes=$2, connections=$3, updated_at=NOW() WHERE id=$4 RETURNING *', [name, nodesJson, connectionsJson, id]);
        return parseScriptOrFlow(res.rows[0]);
    }
    const res = await pool.query('INSERT INTO ivr_flows (id, name, nodes, connections) VALUES ($1, $2, $3, $4) RETURNING *', [flow.id, name, nodesJson, connectionsJson]);
    return parseScriptOrFlow(res.rows[0]);
};
const deleteIvrFlow = async (id) => await pool.query('DELETE FROM ivr_flows WHERE id=$1', [id]);
const duplicateIvrFlow = async (id) => {
    const res = await pool.query('SELECT * FROM ivr_flows WHERE id = $1', [id]);
    if (res.rows.length === 0) {
        throw new Error('IVR Flow not found');
    }
    const originalFlow = parseScriptOrFlow(res.rows[0]);
    const newFlow = {
        ...originalFlow,
        id: `ivr-flow-${Date.now()}`,
        name: `${originalFlow.name} (Copie)`,
    };
    return saveIvrFlow(newFlow);
};

// --- CAMPAIGNS ---
const getCampaigns = async () => {
    const res = await pool.query('SELECT * FROM campaigns ORDER BY name');
    return res.rows.map(keysToCamel);
};
const saveCampaign = async (campaign, id) => {
    const { name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime } = campaign;
     if (id) {
        const res = await pool.query(
            'UPDATE campaigns SET name=$1, description=$2, script_id=$3, qualification_group_id=$4, caller_id=$5, is_active=$6, dialing_mode=$7, wrap_up_time=$8, updated_at=NOW() WHERE id=$9 RETURNING *',
            [name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, id]
        );
        return keysToCamel(res.rows[0]);
    }
    const res = await pool.query(
        'INSERT INTO campaigns (id, name, description, script_id, qualification_group_id, caller_id, is_active, dialing_mode, wrap_up_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [campaign.id, name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime]
    );
    return keysToCamel(res.rows[0]);
};
const deleteCampaign = async (id) => await pool.query('DELETE FROM campaigns WHERE id=$1', [id]);

const importContacts = async (campaignId, contacts) => {
     if (!contacts || contacts.length === 0) return [];
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const insertedContacts = [];
        for (const contact of contacts) {
            const res = await client.query(
                'INSERT INTO contacts (id, campaign_id, first_name, last_name, phone_number, postal_code, status, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [contact.id, campaignId, contact.firstName, contact.lastName, contact.phoneNumber, contact.postalCode, 'pending', JSON.stringify(contact.customFields || {})]
            );
            insertedContacts.push(keysToCamel(res.rows[0]));
        }
        await client.query('COMMIT');
        return insertedContacts;
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

// --- QUALIFICATIONS ---
const getQualifications = async () => (await pool.query('SELECT * FROM qualifications ORDER BY code')).rows.map(keysToCamel);
const getQualificationGroups = async () => (await pool.query('SELECT * FROM qualification_groups ORDER BY name')).rows.map(keysToCamel);
const saveQualification = async (q, id) => {
    if (id) {
        const res = await pool.query('UPDATE qualifications SET code=$1, description=$2, type=$3, parent_id=$4, updated_at=NOW() WHERE id=$5 RETURNING *', [q.code, q.description, q.type, q.parentId, id]);
        return keysToCamel(res.rows[0]);
    }
    const res = await pool.query('INSERT INTO qualifications (id, code, description, type, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING *', [q.id, q.code, q.description, q.type, q.parentId]);
    return keysToCamel(res.rows[0]);
};
const deleteQualification = async (id) => await pool.query('DELETE FROM qualifications WHERE id=$1', [id]);

const saveQualificationGroup = async (group, assignedQualIds, id) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let savedGroup;
        if (id) {
            const res = await client.query('UPDATE qualification_groups SET name=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [group.name, id]);
            savedGroup = res.rows[0];
        } else {
            const res = await client.query('INSERT INTO qualification_groups (id, name) VALUES ($1, $2) RETURNING *', [group.id, group.name]);
            savedGroup = res.rows[0];
        }
        
        await client.query('UPDATE qualifications SET group_id = NULL WHERE group_id = $1', [savedGroup.id]);
        if (assignedQualIds && assignedQualIds.length > 0) {
            const placeholders = assignedQualIds.map((_, i) => `$${i + 2}`).join(',');
            await client.query(`UPDATE qualifications SET group_id = $1 WHERE id IN (${placeholders})`, [savedGroup.id, ...assignedQualIds]);
        }
        
        await client.query('COMMIT');
        return keysToCamel(savedGroup);
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};
const deleteQualificationGroup = async (id) => await pool.query('DELETE FROM qualification_groups WHERE id=$1', [id]);

// --- Telephony Settings ---
const getTrunks = async () => (await pool.query('SELECT * FROM trunks ORDER BY name')).rows.map(keysToCamel);
const saveTrunk = async (trunk, id) => { /* ... */ return keysToCamel(trunk); };
const deleteTrunk = async (id) => { /* ... */ };

const getDids = async () => (await pool.query('SELECT * FROM dids ORDER BY number')).rows.map(keysToCamel);
const saveDid = async (did, id) => { /* ... */ return keysToCamel(did); };
const deleteDid = async (id) => { /* ... */ };

// --- Sites ---
const getSites = async () => (await pool.query('SELECT * FROM sites ORDER BY name')).rows.map(keysToCamel);
const saveSite = async (site, id) => { /* ... */ return keysToCamel(site); };
const deleteSite = async (id) => { /* ... */ };

// --- Audio Files ---
const getAudioFiles = async () => (await pool.query('SELECT * FROM audio_files ORDER BY name')).rows.map(keysToCamel);
const saveAudioFile = async (file, id) => { /* ... */ return keysToCamel(file); };
const deleteAudioFile = async (id) => { /* ... */ };

// --- Planning ---
const getPlanningEvents = async () => (await pool.query('SELECT * FROM planning_events')).rows.map(keysToCamel);
const savePlanningEvent = async (event, id) => { /* ... */ return keysToCamel(event); };
const deletePlanningEvent = async (id) => { /* ... */ };
const getActivityTypes = async () => (await pool.query('SELECT * FROM activity_types ORDER BY name')).rows.map(keysToCamel);
const getPersonalCallbacks = async () => (await pool.query('SELECT * FROM personal_callbacks')).rows.map(keysToCamel);


module.exports = {
    getAllApplicationData,
    authenticateUser,
    getIvrFlowByDnid,
    getUsers, createUser, updateUser, deleteUser,
    getUserGroups, saveUserGroup, deleteUserGroup,
    getCampaigns, saveCampaign, deleteCampaign, importContacts,
    getScripts, saveScript, deleteScript, duplicateScript,
    getIvrFlows, saveIvrFlow, deleteIvrFlow, duplicateIvrFlow,
    getQualifications, saveQualification, deleteQualification,
    getQualificationGroups, saveQualificationGroup, deleteQualificationGroup,
    getTrunks, saveTrunk, deleteTrunk,
    getDids, saveDid, deleteDid,
    getSites, saveSite, deleteSite,
    getAudioFiles, saveAudioFile, deleteAudioFile,
    getPlanningEvents, savePlanningEvent, deletePlanningEvent,
    getActivityTypes,
    getPersonalCallbacks
};