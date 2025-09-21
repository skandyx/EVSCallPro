// backend/services/db.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Utility to convert snake_case keys from DB to camelCase for JS/JSON
const keysToCamel = (obj) => {
    if (obj === null || typeof obj !== 'object' || obj.constructor.name !== 'Object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(v => keysToCamel(v));
    }
    const newObj = {};
    for (let key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const newKey = key.replace(/(_\w)/g, k => k[1].toUpperCase());
            newObj[newKey] = keysToCamel(obj[key]);
        }
    }
    return newObj;
};


// Parse complex JSONB fields from the database
const parseComplexFields = (item, fields) => {
    const newItem = { ...item };
    fields.forEach(field => {
        if (newItem[field] && typeof newItem[field] === 'string') {
            try {
                newItem[field] = JSON.parse(newItem[field]);
            } catch (e) {
                console.error(`Error parsing JSON for field ${field}:`, newItem[field]);
                // Keep it as is or set to a default value
            }
        }
    });
    return newItem;
};

// --- AUTHENTICATION ---
async function authenticateUser(loginId, password) {
    // In a real app, password should be hashed with bcrypt.
    // const res = await pool.query('SELECT * FROM users WHERE login_id = $1', [loginId]);
    // if (res.rows.length > 0) {
    //     const user = res.rows[0];
    //     const match = await bcrypt.compare(password, user.password_hash);
    //     if (match) {
    //         delete user.password_hash;
    //         return keysToCamel(user);
    //     }
    // }
    // For this project, we compare plaintext passwords.
    const res = await pool.query('SELECT * FROM users WHERE login_id = $1 AND password_hash = $2', [loginId, password]);
    if (res.rows.length > 0) {
        const user = res.rows[0];
        delete user.password_hash; // Never send password hash to client
        return keysToCamel(user);
    }
    return null;
}


// --- DATA GETTERS ---

const getUsers = async () => {
    const res = await pool.query('SELECT id, login_id, first_name, last_name, email, role, is_active, site_id FROM users ORDER BY first_name, last_name');
    const users = keysToCamel(res.rows);
    // Fetch assigned campaign IDs for each user
    for (const user of users) {
        const campaignRes = await pool.query('SELECT campaign_id FROM campaign_agents WHERE user_id = $1', [user.id]);
        user.campaignIds = campaignRes.rows.map(r => r.campaign_id);
    }
    return users;
};
const getUserGroups = async () => {
    const res = await pool.query('SELECT * FROM user_groups ORDER BY name');
    const groups = keysToCamel(res.rows);
    for (const group of groups) {
        const membersRes = await pool.query('SELECT user_id FROM user_group_members WHERE group_id = $1', [group.id]);
        group.memberIds = membersRes.rows.map(r => r.user_id);
    }
    return groups;
};
const getCampaigns = async () => {
    const res = await pool.query('SELECT * FROM campaigns ORDER BY name');
    const campaigns = keysToCamel(res.rows);
    for (const campaign of campaigns) {
        const contactsRes = await pool.query('SELECT * FROM contacts WHERE campaign_id = $1', [campaign.id]);
        campaign.contacts = keysToCamel(contactsRes.rows);
        // This is a simplified stand-in. In a real app, you'd join tables.
        const agentsRes = await pool.query('SELECT user_id FROM campaign_agents WHERE campaign_id = $1', [campaign.id]);
        campaign.assignedUserIds = agentsRes.rows.map(r => r.user_id);
    }
    return campaigns;
};
const getScripts = async () => {
    const res = await pool.query('SELECT * FROM scripts ORDER BY name');
    // Ensure pages, which are stored as JSONB, are parsed correctly
    return keysToCamel(res.rows).map(script => parseComplexFields(script, ['pages']));
};
const getIvrFlows = async () => {
    const res = await pool.query('SELECT * FROM ivr_flows ORDER BY name');
    // Ensure nodes and connections, which are stored as JSONB, are parsed correctly
    return keysToCamel(res.rows).map(flow => parseComplexFields(flow, ['nodes', 'connections']));
};
const getQualifications = async () => (await pool.query('SELECT * FROM qualifications ORDER BY code')).rows.map(keysToCamel);
const getQualificationGroups = async () => (await pool.query('SELECT * FROM qualification_groups ORDER BY name')).rows.map(keysToCamel);
const getTrunks = async () => (await pool.query('SELECT * FROM trunks ORDER BY name')).rows.map(keysToCamel);
const getDids = async () => (await pool.query('SELECT * FROM dids ORDER BY number')).rows.map(keysToCamel);
const getSites = async () => (await pool.query('SELECT * FROM sites ORDER BY name')).rows.map(keysToCamel);
const getAudioFiles = async () => (await pool.query('SELECT * FROM audio_files ORDER BY name')).rows.map(keysToCamel);
const getPlanningEvents = async () => (await pool.query('SELECT * FROM planning_events ORDER BY start_date')).rows.map(keysToCamel);


async function getAllApplicationData() {
    // This function loads all necessary data in parallel for the initial app load.
    const [
        users, userGroups, campaigns, savedScripts, ivrFlows,
        qualifications, qualificationGroups, dids, trunks, sites, audioFiles, planningEvents
    ] = await Promise.all([
        getUsers(),
        getUserGroups(),
        getCampaigns(),
        getScripts(),
        getIvrFlows(),
        getQualifications(),
        getQualificationGroups(),
        getDids(),
        getTrunks(),
        getSites(),
        getAudioFiles(),
        getPlanningEvents(),
    ]);

    return {
        users,
        userGroups,
        campaigns,
        savedScripts,
        savedIvrFlows: ivrFlows,
        qualifications,
        qualificationGroups,
        dids,
        trunks,
        sites,
        audioFiles,
        planningEvents,
        // Mock data for features not yet implemented in DB
        personalCallbacks: [],
        systemConnectionSettings: {},
        backupSchedule: {},
        backupLogs: [],
    };
}


// --- DATA SAVERS ---

// Users
async function createUser(user, groupIds = []) {
    const { loginId, firstName, lastName, email, role, isActive, password, siteId, campaignIds = [] } = user;
    // In a real app, you would hash the password here. e.g., const passwordHash = await bcrypt.hash(password, 10);
    const passwordHash = password; // For this project, storing plaintext
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const res = await client.query(
            'INSERT INTO users (id, login_id, first_name, last_name, email, role, is_active, password_hash, site_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [user.id, loginId, firstName, lastName, email || null, role, isActive, passwordHash, siteId || null]
        );
        const newUser = keysToCamel(res.rows[0]);
        delete newUser.passwordHash;

        // Handle group assignments
        for (const groupId of groupIds) {
            await client.query('INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)', [newUser.id, groupId]);
        }
        
        // Handle campaign assignments
        for (const campaignId of campaignIds) {
            await client.query('INSERT INTO campaign_agents (user_id, campaign_id) VALUES ($1, $2)', [newUser.id, campaignId]);
        }

        await client.query('COMMIT');
        return newUser;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function updateUser(id, user, groupIds = []) {
    const { loginId, firstName, lastName, email, role, isActive, password, siteId, campaignIds = [] } = user;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Build the update query dynamically
        const updateFields = [];
        const values = [];
        let valueIndex = 1;

        if (loginId !== undefined) { updateFields.push(`login_id = $${valueIndex++}`); values.push(loginId); }
        if (firstName !== undefined) { updateFields.push(`first_name = $${valueIndex++}`); values.push(firstName); }
        if (lastName !== undefined) { updateFields.push(`last_name = $${valueIndex++}`); values.push(lastName); }
        if (email !== undefined) { updateFields.push(`email = $${valueIndex++}`); values.push(email || null); }
        if (role !== undefined) { updateFields.push(`role = $${valueIndex++}`); values.push(role); }
        if (isActive !== undefined) { updateFields.push(`is_active = $${valueIndex++}`); values.push(isActive); }
        if (password) { // CRITICAL: Only update password if a new one is provided
            // In a real app, hash it: const passwordHash = await bcrypt.hash(password, 10);
            const passwordHash = password;
            updateFields.push(`password_hash = $${valueIndex++}`);
            values.push(passwordHash);
        }
        if (siteId !== undefined) { updateFields.push(`site_id = $${valueIndex++}`); values.push(siteId || null); }
        
        values.push(id);
        
        const res = await client.query(
            `UPDATE users SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${valueIndex} RETURNING *`,
            values
        );

        // Update group memberships
        await client.query('DELETE FROM user_group_members WHERE user_id = $1', [id]);
        for (const groupId of groupIds) {
            await client.query('INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)', [id, groupId]);
        }
        
        // Update campaign assignments
        await client.query('DELETE FROM campaign_agents WHERE user_id = $1', [id]);
        for (const campaignId of campaignIds) {
            await client.query('INSERT INTO campaign_agents (user_id, campaign_id) VALUES ($1, $2)', [id, campaignId]);
        }

        await client.query('COMMIT');
        
        const updatedUser = keysToCamel(res.rows[0]);
        delete updatedUser.passwordHash;
        return updatedUser;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

const deleteUser = (id) => pool.query('DELETE FROM users WHERE id = $1', [id]);

// Groups
async function saveUserGroup(group, id) {
    const { name, memberIds } = group;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let savedGroup;
        if (id) {
            const res = await client.query('UPDATE user_groups SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
            savedGroup = res.rows[0];
            await client.query('DELETE FROM user_group_members WHERE group_id = $1', [id]);
        } else {
            const res = await client.query('INSERT INTO user_groups (id, name) VALUES ($1, $2) RETURNING *', [group.id, name]);
            savedGroup = res.rows[0];
        }
        for (const userId of memberIds) {
            await client.query('INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)', [userId, savedGroup.id]);
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
const deleteUserGroup = (id) => pool.query('DELETE FROM user_groups WHERE id = $1', [id]);


// Campaigns & Contacts
async function saveCampaign(campaign, id) {
    const { name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime } = campaign;
    if (id) {
        const res = await pool.query('UPDATE campaigns SET name=$1, description=$2, script_id=$3, qualification_group_id=$4, caller_id=$5, is_active=$6, dialing_mode=$7, wrap_up_time=$8 WHERE id=$9 RETURNING *', [name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, id]);
        return keysToCamel(res.rows[0]);
    }
    const res = await pool.query('INSERT INTO campaigns (id, name, description, script_id, qualification_group_id, caller_id, is_active, dialing_mode, wrap_up_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *', [campaign.id, name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime]);
    return keysToCamel(res.rows[0]);
}

const deleteCampaign = (id) => pool.query('DELETE FROM campaigns WHERE id = $1', [id]);

async function importContacts(campaignId, contacts) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const contact of contacts) {
            const { id, firstName, lastName, phoneNumber, postalCode, status, customFields } = contact;
            await client.query(
                'INSERT INTO contacts (id, campaign_id, first_name, last_name, phone_number, postal_code, status, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [id, campaignId, firstName, lastName, phoneNumber, postalCode, status, JSON.stringify(customFields || {})]
            );
        }
        await client.query('COMMIT');
        return { success: true, imported: contacts.length };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}


// Scripts
async function saveScript(script, id) {
    const { name, pages, startPageId, backgroundColor } = script;
    if (id) {
        const res = await pool.query('UPDATE scripts SET name=$1, pages=$2, start_page_id=$3, background_color=$4 WHERE id=$5 RETURNING *', [name, JSON.stringify(pages), startPageId, backgroundColor, id]);
        return keysToCamel(res.rows[0]);
    }
    const res = await pool.query('INSERT INTO scripts (id, name, pages, start_page_id, background_color) VALUES ($1, $2, $3, $4, $5) RETURNING *', [script.id, name, JSON.stringify(pages), startPageId, backgroundColor]);
    return keysToCamel(res.rows[0]);
}
const deleteScript = (id) => pool.query('DELETE FROM scripts WHERE id = $1', [id]);
// ... duplicateScript logic here ...

// IVR
async function saveIvrFlow(flow, id) {
    const { name, nodes, connections } = flow;
    if (id) {
        const res = await pool.query('UPDATE ivr_flows SET name=$1, nodes=$2, connections=$3 WHERE id=$4 RETURNING *', [name, JSON.stringify(nodes), JSON.stringify(connections), id]);
        return keysToCamel(res.rows[0]);
    }
    const res = await pool.query('INSERT INTO ivr_flows (id, name, nodes, connections) VALUES ($1, $2, $3, $4) RETURNING *', [flow.id, name, JSON.stringify(nodes), JSON.stringify(connections)]);
    return keysToCamel(res.rows[0]);
}
const deleteIvrFlow = (id) => pool.query('DELETE FROM ivr_flows WHERE id = $1', [id]);
const getIvrFlowByDnid = async (dnid) => {
    const res = await pool.query('SELECT f.* FROM ivr_flows f JOIN dids d ON f.id = d.ivr_flow_id WHERE d.number = $1', [dnid]);
    if (res.rows.length === 0) return null;
    return keysToCamel(res.rows[0]);
};


// Qualifications
async function saveQualification(qual, id) {
    const { code, description, type, parentId } = qual;
    if (id) {
        const res = await pool.query('UPDATE qualifications SET code=$1, description=$2, type=$3, parent_id=$4 WHERE id=$5 RETURNING *', [code, description, type, parentId, id]);
        return keysToCamel(res.rows[0]);
    }
    const res = await pool.query('INSERT INTO qualifications (id, code, description, type, is_standard, parent_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [qual.id, code, description, type, false, parentId]);
    return keysToCamel(res.rows[0]);
}
const deleteQualification = (id) => pool.query('DELETE FROM qualifications WHERE id = $1 AND is_standard = false', [id]);

async function saveQualificationGroup(group, assignedQualIds, id) {
    const { name } = group;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let savedGroup;
        if (id) {
            const res = await client.query('UPDATE qualification_groups SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
            savedGroup = res.rows[0];
            // Dis-assign all qualifications from this group first
            await client.query('UPDATE qualifications SET group_id = NULL WHERE group_id = $1', [id]);
        } else {
            const res = await client.query('INSERT INTO qualification_groups (id, name) VALUES ($1, $2) RETURNING *', [group.id, name]);
            savedGroup = res.rows[0];
        }
        // Re-assign selected qualifications
        for (const qualId of assignedQualIds) {
            await client.query('UPDATE qualifications SET group_id = $1 WHERE id = $2', [savedGroup.id, qualId]);
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
const deleteQualificationGroup = (id) => pool.query('DELETE FROM qualification_groups WHERE id = $1', [id]);

// Simplified CRUD for remaining simple entities
const createSimpleSaver = (table) => async (entity, id) => {
    const keys = Object.keys(entity).filter(k => k !== 'id');
    const values = keys.map(k => entity[k]);

    if (id) {
        const setString = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        const res = await pool.query(`UPDATE ${table} SET ${setString} WHERE id = $${keys.length + 1} RETURNING *`, [...values, id]);
        return keysToCamel(res.rows[0]);
    }
    const columns = ['id', ...keys].join(', ');
    const placeholders = ['$1', ...keys.map((_, i) => `$${i + 2}`)].join(', ');
    const res = await pool.query(`INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`, [entity.id, ...values]);
    return keysToCamel(res.rows[0]);
};

const createSimpleDeleter = (table) => (id) => pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);

module.exports = {
    getAllApplicationData,
    authenticateUser,
    getUsers, createUser, updateUser, deleteUser,
    getUserGroups, saveUserGroup, deleteUserGroup,
    getCampaigns, saveCampaign, deleteCampaign, importContacts,
    getScripts, saveScript, deleteScript,
    getIvrFlows, saveIvrFlow, deleteIvrFlow, getIvrFlowByDnid,
    getQualifications, saveQualification, deleteQualification,
    getQualificationGroups, saveQualificationGroup, deleteQualificationGroup,
    saveTrunk: createSimpleSaver('trunks'), deleteTrunk: createSimpleDeleter('trunks'), getTrunks,
    saveDid: createSimpleSaver('dids'), deleteDid: createSimpleDeleter('dids'), getDids,
    saveSite: createSimpleSaver('sites'), deleteSite: createSimpleDeleter('sites'), getSites,
    saveAudioFile: createSimpleSaver('audio_files'), deleteAudioFile: createSimpleDeleter('audio_files'), getAudioFiles,
    savePlanningEvent: createSimpleSaver('planning_events'), deletePlanningEvent: createSimpleDeleter('planning_events'), getPlanningEvents,
};
