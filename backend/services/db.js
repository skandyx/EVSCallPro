
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Helper to add password_hash if password is provided
const processUserData = (user) => {
    const userToSave = { ...user };
    if (userToSave.password) {
        // In a real app, hash the password here with bcrypt
        userToSave.password_hash = userToSave.password;
        delete userToSave.password;
    }
    return userToSave;
};

// --- USERS ---
async function getUsers() {
    const client = await pool.connect();
    try {
        const usersRes = await client.query('SELECT id, login_id, first_name, last_name, email, "role", is_active, site_id FROM users ORDER BY last_name, first_name');
        const membersRes = await client.query('SELECT * FROM user_group_members');
        
        const users = usersRes.rows;
        
        // This part is for campaignIds, which is managed on the campaign side.
        // We initialize it here to match the frontend type.
        users.forEach(u => {
            u.campaignIds = [];
        });

        return users;

    } finally {
        client.release();
    }
}

async function createUser(user, groupIds) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const userToSave = processUserData(user);
        const { id, login_id, first_name, last_name, email, role, is_active, password_hash, site_id } = userToSave;
        const res = await client.query(
            'INSERT INTO users (id, login_id, first_name, last_name, email, "role", is_active, password_hash, site_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [id, login_id, first_name, last_name, email || null, role, is_active, password_hash, site_id || null]
        );
        const newUser = res.rows[0];

        if (groupIds && groupIds.length > 0) {
            for (const groupId of groupIds) {
                await client.query('INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)', [newUser.id, groupId]);
            }
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

async function updateUser(userId, user, groupIds) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const userToSave = processUserData(user);
        const { first_name, last_name, email, role, is_active, password_hash, site_id, login_id } = userToSave;
        
        const res = await client.query(
            'UPDATE users SET login_id = $1, first_name = $2, last_name = $3, email = $4, "role" = $5, is_active = $6, password_hash = COALESCE($7, password_hash), site_id = $8, updated_at = NOW() WHERE id = $9 RETURNING *',
            [login_id, first_name, last_name, email || null, role, is_active, password_hash, site_id || null, userId]
        );
        const updatedUser = res.rows[0];

        await client.query('DELETE FROM user_group_members WHERE user_id = $1', [userId]);
        if (groupIds && groupIds.length > 0) {
            for (const groupId of groupIds) {
                await client.query('INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)', [userId, groupId]);
            }
        }
        await client.query('COMMIT');
        return updatedUser;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function deleteUser(userId) {
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

// --- USER GROUPS ---
async function getUserGroups() {
    const client = await pool.connect();
    try {
        const groupsRes = await client.query('SELECT * FROM user_groups ORDER BY name');
        const membersRes = await client.query('SELECT * FROM user_group_members');
        const groups = groupsRes.rows;
        groups.forEach(g => {
            g.memberIds = membersRes.rows.filter(m => m.group_id === g.id).map(m => m.user_id);
        });
        return groups;
    } finally {
        client.release();
    }
}

async function saveUserGroup(group, groupId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let savedGroup;
        if (groupId) {
            const res = await client.query('UPDATE user_groups SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [group.name, groupId]);
            savedGroup = res.rows[0];
        } else {
            const res = await client.query('INSERT INTO user_groups (id, name) VALUES ($1, $2) RETURNING *', [group.id, group.name]);
            savedGroup = res.rows[0];
        }

        await client.query('DELETE FROM user_group_members WHERE group_id = $1', [savedGroup.id]);
        if (group.memberIds && group.memberIds.length > 0) {
            for (const userId of group.memberIds) {
                await client.query('INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)', [userId, savedGroup.id]);
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
}

async function deleteUserGroup(groupId) {
    await pool.query('DELETE FROM user_groups WHERE id = $1', [groupId]);
}

// --- SCRIPT ---
async function saveScript(script, scriptId) {
     if (scriptId) {
        const res = await pool.query('UPDATE scripts SET name = $1, pages = $2, start_page_id = $3, background_color = $4, updated_at = NOW() WHERE id = $5 RETURNING *', [script.name, JSON.stringify(script.pages), script.startPageId, script.backgroundColor, scriptId]);
        return res.rows[0];
    } else {
        const res = await pool.query('INSERT INTO scripts (id, name, pages, start_page_id, background_color) VALUES ($1, $2, $3, $4, $5) RETURNING *', [script.id, script.name, JSON.stringify(script.pages), script.startPageId, script.backgroundColor]);
        return res.rows[0];
    }
}
async function deleteScript(scriptId) { await pool.query('DELETE FROM scripts WHERE id = $1', [scriptId]); }
async function duplicateScript(scriptId) {
    const res = await pool.query('SELECT * FROM scripts WHERE id = $1', [scriptId]);
    const originalScript = res.rows[0];
    if (!originalScript) throw new Error('Script not found');

    const newScript = {
        ...originalScript,
        id: `script-${Date.now()}`,
        name: `${originalScript.name} (Copie)`,
    };

    return saveScript(newScript);
}

// --- QUALIFICATIONS ---
async function saveQualification(qual, qualId) {
     if (qualId) {
        const res = await pool.query('UPDATE qualifications SET code = $1, description = $2, "type" = $3, parent_id = $4, updated_at = NOW() WHERE id = $5 RETURNING *', [qual.code, qual.description, qual.type, qual.parentId, qualId]);
        return res.rows[0];
    } else {
        const res = await pool.query('INSERT INTO qualifications (id, code, description, "type", parent_id, is_standard) VALUES ($1, $2, $3, $4, $5, false) RETURNING *', [qual.id, qual.code, qual.description, qual.type, qual.parentId]);
        return res.rows[0];
    }
}
async function deleteQualification(qualId) { await pool.query('DELETE FROM qualifications WHERE id = $1', [qualId]); }

async function saveQualificationGroup(group, assignedQualIds, groupId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let savedGroup;
        if (groupId) {
            const res = await client.query('UPDATE qualification_groups SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [group.name, groupId]);
            savedGroup = res.rows[0];
        } else {
            const res = await client.query('INSERT INTO qualification_groups (id, name) VALUES ($1, $2) RETURNING *', [group.id, group.name]);
            savedGroup = res.rows[0];
        }

        // Unassign all non-standard quals from this group first
        await client.query('UPDATE qualifications SET group_id = NULL WHERE group_id = $1 AND is_standard = false', [savedGroup.id]);

        // Assign the selected quals to this group
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
}
async function deleteQualificationGroup(groupId) { await pool.query('DELETE FROM qualification_groups WHERE id = $1', [groupId]); }

// --- CAMPAIGNS ---
async function saveCampaign(campaign, campaignId) {
    const { name, description, script_id, qualification_group_id, caller_id, is_active, dialing_mode, wrap_up_time, assignedUserIds } = campaign;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let savedCampaign;
        if (campaignId) {
            const res = await client.query('UPDATE campaigns SET name = $1, description = $2, script_id = $3, qualification_group_id = $4, caller_id = $5, is_active = $6, dialing_mode = $7, wrap_up_time = $8, updated_at = NOW() WHERE id = $9 RETURNING *', [name, description, script_id, qualification_group_id, caller_id, is_active, dialing_mode, wrap_up_time, campaignId]);
            savedCampaign = res.rows[0];
        } else {
            const res = await client.query('INSERT INTO campaigns (id, name, description, script_id, qualification_group_id, caller_id, is_active, dialing_mode, wrap_up_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *', [campaign.id, name, description, script_id, qualification_group_id, caller_id, is_active, dialing_mode, wrap_up_time]);
            savedCampaign = res.rows[0];
        }

        await client.query('DELETE FROM campaign_agents WHERE campaign_id = $1', [savedCampaign.id]);
        if (assignedUserIds && assignedUserIds.length > 0) {
            for (const userId of assignedUserIds) {
                await client.query('INSERT INTO campaign_agents (campaign_id, user_id) VALUES ($1, $2)', [savedCampaign.id, userId]);
            }
        }
        await client.query('COMMIT');
        return savedCampaign;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}
async function deleteCampaign(campaignId) { await pool.query('DELETE FROM campaigns WHERE id = $1', [campaignId]); }
async function importContacts(campaignId, contacts) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const contact of contacts) {
            await client.query('INSERT INTO contacts (id, campaign_id, first_name, last_name, phone_number, postal_code, status, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [contact.id, campaignId, contact.firstName, contact.lastName, contact.phoneNumber, contact.postalCode, 'pending', JSON.stringify(contact.customFields || {})]);
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

// --- IVR ---
async function saveIvrFlow(flow, flowId) {
    if (flowId) {
        const res = await pool.query('UPDATE ivr_flows SET name = $1, nodes = $2, connections = $3, updated_at = NOW() WHERE id = $4 RETURNING *', [flow.name, JSON.stringify(flow.nodes), JSON.stringify(flow.connections), flowId]);
        return res.rows[0];
    } else {
        const res = await pool.query('INSERT INTO ivr_flows (id, name, nodes, connections) VALUES ($1, $2, $3, $4) RETURNING *', [flow.id, flow.name, JSON.stringify(flow.nodes), JSON.stringify(flow.connections)]);
        return res.rows[0];
    }
}
async function deleteIvrFlow(flowId) { await pool.query('DELETE FROM ivr_flows WHERE id = $1', [flowId]); }
async function duplicateIvrFlow(flowId) {
    const res = await pool.query('SELECT * FROM ivr_flows WHERE id = $1', [flowId]);
    const originalFlow = res.rows[0];
    if (!originalFlow) throw new Error('IVR Flow not found');
    const newFlow = { ...originalFlow, id: `ivr-flow-${Date.now()}`, name: `${originalFlow.name} (Copie)` };
    return saveIvrFlow(newFlow);
}
async function getIvrFlowByDnid(dnid) {
    const res = await pool.query('SELECT f.* FROM ivr_flows f JOIN dids d ON f.id = d.ivr_flow_id WHERE d.number = $1', [dnid]);
    return res.rows[0];
}

// --- TELEPHONY PARAMS ---
async function saveTrunk(t, id) { if (id) { return (await pool.query('UPDATE trunks SET name=$1, domain=$2, login=$3, auth_type=$4, dial_pattern=$5, inbound_context=$6 WHERE id=$7 RETURNING *', [t.name, t.domain, t.login, t.auth_type, t.dialPattern, t.inboundContext, id])).rows[0]; } else { return (await pool.query('INSERT INTO trunks (id, name, domain, login, auth_type, dial_pattern, inbound_context) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [t.id, t.name, t.domain, t.login, t.auth_type, t.dialPattern, t.inboundContext])).rows[0]; }}
async function deleteTrunk(id) { await pool.query('DELETE FROM trunks WHERE id = $1', [id]); }
async function saveDid(d, id) { if (id) { return (await pool.query('UPDATE dids SET "number"=$1, description=$2, trunk_id=$3, ivr_flow_id=$4 WHERE id=$5 RETURNING *', [d.number, d.description, d.trunkId, d.ivrFlowId, id])).rows[0]; } else { return (await pool.query('INSERT INTO dids (id, "number", description, trunk_id, ivr_flow_id) VALUES ($1,$2,$3,$4,$5) RETURNING *', [d.id, d.number, d.description, d.trunkId, d.ivrFlowId])).rows[0]; }}
async function deleteDid(id) { await pool.query('DELETE FROM dids WHERE id = $1', [id]); }
async function saveSite(s, id) { if (id) { return (await pool.query('UPDATE sites SET name=$1, yeastar_ip=$2, api_user=$3, api_password=$4 WHERE id=$5 RETURNING *', [s.name, s.yeastarIp, s.apiUser, s.apiPassword, id])).rows[0]; } else { return (await pool.query('INSERT INTO sites (id, name, yeastar_ip, api_user, api_password) VALUES ($1,$2,$3,$4,$5) RETURNING *', [s.id, s.name, s.yeastarIp, s.apiUser, s.apiPassword])).rows[0]; }}
async function deleteSite(id) { await pool.query('DELETE FROM sites WHERE id = $1', [id]); }

// --- OTHER ---
async function saveAudioFile(f, id) { if (id) { return (await pool.query('UPDATE audio_files SET name=$1 WHERE id=$2 RETURNING *', [f.name, id])).rows[0]; } else { return (await pool.query('INSERT INTO audio_files (id, name, file_name, duration, size, upload_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [f.id, f.name, f.fileName, f.duration, f.size, f.uploadDate])).rows[0]; }}
async function deleteAudioFile(id) { await pool.query('DELETE FROM audio_files WHERE id = $1', [id]); }
async function savePlanningEvent(e, id) { if (id) { return (await pool.query('UPDATE planning_events SET agent_id=$1, activity_id=$2, start_date=$3, end_date=$4 WHERE id=$5 RETURNING *', [e.agentId, e.activityId, e.startDate, e.endDate, id])).rows[0]; } else { return (await pool.query('INSERT INTO planning_events (id, agent_id, activity_id, start_date, end_date) VALUES ($1,$2,$3,$4,$5) RETURNING *', [e.id, e.agentId, e.activityId, e.startDate, e.endDate])).rows[0]; }}
async function deletePlanningEvent(id) { await pool.query('DELETE FROM planning_events WHERE id = $1', [id]); }

// --- MASTER DATA LOADER ---
async function getAllApplicationData() {
    const client = await pool.connect();
    try {
        const queries = [
            client.query('SELECT * FROM sites ORDER BY name'),
            client.query('SELECT id, login_id, first_name, last_name, email, "role", is_active, site_id FROM users ORDER BY last_name, first_name'),
            client.query('SELECT * FROM user_groups ORDER BY name'),
            client.query('SELECT * FROM scripts ORDER BY name'),
            client.query('SELECT * FROM ivr_flows ORDER BY name'),
            client.query('SELECT * FROM campaigns ORDER BY name'),
            client.query('SELECT id, code, description, "type", group_id, is_standard, parent_id FROM qualifications ORDER BY code'),
            client.query('SELECT * FROM qualification_groups ORDER BY name'),
            client.query('SELECT id, name, domain, login, auth_type, register_string, dial_pattern, inbound_context, force_caller_id FROM trunks ORDER BY name'),
            client.query('SELECT * FROM dids ORDER BY "number"'),
            client.query('SELECT * FROM audio_files ORDER BY name'),
            client.query('SELECT * FROM activity_types ORDER BY name'),
            client.query('SELECT * FROM planning_events ORDER BY start_date'),
            client.query('SELECT * FROM personal_callbacks ORDER BY scheduled_time'),
            client.query('SELECT * FROM call_history ORDER BY "timestamp" DESC LIMIT 100'),
            client.query('SELECT * FROM agent_sessions ORDER BY login_time DESC LIMIT 100'),
            client.query('SELECT * FROM user_group_members'),
            client.query('SELECT * FROM campaign_agents'),
            client.query('SELECT * FROM contacts')
        ];

        const results = await Promise.all(queries);

        const [
            sitesRes, usersRes, userGroupsRes, scriptsRes, ivrFlowsRes, campaignsRes,
            qualificationsRes, qualGroupsRes, trunksRes, didsRes, audioFilesRes,
            activityTypesRes, planningEventsRes, personalCallbacksRes, callHistoryRes,
            agentSessionsRes, userGroupMembersRes, campaignAgentsRes, contactsRes
        ] = results.map(res => res.rows);

        const userGroups = userGroupsRes.map(g => ({
            ...g,
            memberIds: userGroupMembersRes.filter(m => m.group_id === g.id).map(m => m.user_id)
        }));

        const campaigns = campaignsRes.map(c => ({
            ...c,
            assignedUserIds: campaignAgentsRes.filter(m => m.campaign_id === c.id).map(m => m.user_id),
            contacts: contactsRes.filter(ct => ct.campaign_id === c.id)
        }));
        
        const users = usersRes.map(u => ({
            ...u,
            campaignIds: campaigns.filter(c => c.assignedUserIds.includes(u.id)).map(c => c.id)
        }));

        return {
            sites: sitesRes,
            users: users,
            userGroups: userGroups,
            savedScripts: scriptsRes,
            savedIvrFlows: ivrFlowsRes,
            campaigns: campaigns,
            qualifications: qualificationsRes,
            qualificationGroups: qualGroupsRes,
            trunks: trunksRes,
            dids: didsRes,
            audioFiles: audioFilesRes,
            activityTypes: activityTypesRes,
            planningEvents: planningEventsRes,
            personalCallbacks: personalCallbacksRes,
            callHistory: callHistoryRes,
            agentSessions: agentSessionsRes,
        };
    } finally {
        client.release();
    }
}


module.exports = {
    getAllApplicationData,
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    getUserGroups,
    saveUserGroup,
    deleteUserGroup,
    saveScript,
    deleteScript,
    duplicateScript,
    saveQualification,
    deleteQualification,
    saveQualificationGroup,
    deleteQualificationGroup,
    saveCampaign,
    deleteCampaign,
    importContacts,
    saveIvrFlow,
    deleteIvrFlow,
    duplicateIvrFlow,
    getIvrFlowByDnid,
    saveTrunk,
    deleteTrunk,
    saveDid,
    deleteDid,
    saveSite,
    deleteSite,
    saveAudioFile,
    deleteAudioFile,
    savePlanningEvent,
    deletePlanningEvent,
};
