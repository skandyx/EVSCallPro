const pool = require('./connection');
const { keysToCamel } = require('./utils');

// Define safe columns to be returned, excluding sensitive ones like password_hash
const SAFE_USER_COLUMNS = 'id, login_id, first_name, last_name, email, "role", is_active, site_id, created_at, updated_at, extension';

const getUsers = async () => {
    const res = await pool.query(`SELECT ${SAFE_USER_COLUMNS} FROM users ORDER BY first_name, last_name`);
    return res.rows.map(keysToCamel);
};

const getUserById = async (id) => {
    const res = await pool.query(`SELECT ${SAFE_USER_COLUMNS} FROM users WHERE id = $1`, [id]);
    if (res.rows.length > 0) {
        return keysToCamel(res.rows[0]);
    }
    return null;
};

const createUser = async (user, groupIds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const userQuery = `
            INSERT INTO users (id, login_id, first_name, last_name, email, "role", is_active, password_hash, site_id, extension)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $2) -- Note: extension uses the same value as login_id ($2)
            RETURNING ${SAFE_USER_COLUMNS};
        `;
        const userRes = await client.query(userQuery, [
            user.id, user.loginId, user.firstName, user.lastName, user.email || null,
            user.role, user.isActive, user.password, user.siteId || null
        ]);

        const newUser = userRes.rows[0];

        if (groupIds && groupIds.length > 0) {
            for (const groupId of groupIds) {
                await client.query(
                    'INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)',
                    [newUser.id, groupId]
                );
            }
        }
        
        if (user.campaignIds && user.campaignIds.length > 0) {
            for (const campaignId of user.campaignIds) {
                await client.query('INSERT INTO campaign_agents (user_id, campaign_id) VALUES ($1, $2)', [newUser.id, campaignId]);
            }
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

        const hasPassword = user.password && user.password.trim() !== '';
        
        const queryParams = [
            user.loginId, user.firstName, user.lastName, user.email || null,
            user.role, user.isActive, user.siteId || null
        ];
        
        let passwordUpdateClause = '';
        if (hasPassword) {
            passwordUpdateClause = `, password_hash = $${queryParams.length + 1}`;
            queryParams.push(user.password);
        }
        
        queryParams.push(userId);
        const userIdIndex = queryParams.length;

        const userQuery = `
            UPDATE users SET 
                login_id = $1, first_name = $2, last_name = $3, email = $4, 
                "role" = $5, is_active = $6, site_id = $7,
                extension = $1 -- Note: extension is synced with login_id
                ${passwordUpdateClause}, updated_at = NOW()
            WHERE id = $${userIdIndex}
            RETURNING ${SAFE_USER_COLUMNS};
        `;

        const { rows: updatedUserRows } = await client.query(userQuery, queryParams);
        if (updatedUserRows.length === 0) {
            throw new Error('User not found for update.');
        }

        // Update group memberships
        const { rows: currentGroups } = await client.query('SELECT group_id FROM user_group_members WHERE user_id = $1', [userId]);
        const currentGroupIds = new Set(currentGroups.map(g => g.group_id));
        const desiredGroupIds = new Set(groupIds || []);
        const toAdd = [...desiredGroupIds].filter(id => !currentGroupIds.has(id));
        const toRemove = [...currentGroupIds].filter(id => !desiredGroupIds.has(id));
        if (toRemove.length > 0) await client.query(`DELETE FROM user_group_members WHERE user_id = $1 AND group_id = ANY($2::text[])`, [userId, toRemove]);
        if (toAdd.length > 0) for (const groupId of toAdd) await client.query('INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)', [userId, groupId]);

        // Update campaign assignments
        const { rows: currentCampaigns } = await client.query('SELECT campaign_id FROM campaign_agents WHERE user_id = $1', [userId]);
        const currentCampaignIds = new Set(currentCampaigns.map(c => c.campaign_id));
        const desiredCampaignIds = new Set(user.campaignIds || []);
        const campaignsToAdd = [...desiredCampaignIds].filter(id => !currentCampaignIds.has(id));
        const campaignsToRemove = [...currentCampaignIds].filter(id => !desiredCampaignIds.has(id));
        if (campaignsToRemove.length > 0) await client.query(`DELETE FROM campaign_agents WHERE user_id = $1 AND campaign_id = ANY($2::text[])`, [userId, campaignsToRemove]);
        if (campaignsToAdd.length > 0) for (const campaignId of campaignsToAdd) await client.query('INSERT INTO campaign_agents (user_id, campaign_id) VALUES ($1, $2)', [userId, campaignId]);
        
        await client.query('COMMIT');
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

module.exports = {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
};