const pool = require('./connection');
const { keysToCamel } = require('./utils');

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
            for (const groupId of groupIds) {
                await client.query(
                    'INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)',
                    [newUser.id, groupId]
                );
            }
        }
        
        if (user.campaignIds && user.campaignIds.length > 0) {
            const campaignValues = user.campaignIds.map((campaignId, i) => `($1, $${i + 2})`).join(',');
            await client.query(`INSERT INTO campaign_agents (user_id, campaign_id) VALUES ${campaignValues}`, [newUser.id, ...user.campaignIds]);
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

        // Step 2: Update group memberships using diff logic
        const { rows: currentGroups } = await client.query('SELECT group_id FROM user_group_members WHERE user_id = $1', [userId]);
        const currentGroupIds = new Set(currentGroups.map(g => g.group_id));
        const desiredGroupIds = new Set(groupIds || []);

        const groupsToAdd = [...desiredGroupIds].filter(id => !currentGroupIds.has(id));
        const groupsToRemove = [...currentGroupIds].filter(id => !desiredGroupIds.has(id));

        if (groupsToRemove.length > 0) {
            const placeholders = groupsToRemove.map((_, i) => `$${i + 2}`).join(',');
            await client.query(`DELETE FROM user_group_members WHERE user_id = $1 AND group_id IN (${placeholders})`, [userId, ...groupsToRemove]);
        }
        if (groupsToAdd.length > 0) {
            for (const groupId of groupsToAdd) {
                await client.query('INSERT INTO user_group_members (user_id, group_id) VALUES ($1, $2)', [userId, groupId]);
            }
        }
        
        // Step 3: Update campaign assignments using diff logic
        const { rows: currentCampaigns } = await client.query('SELECT campaign_id FROM campaign_agents WHERE user_id = $1', [userId]);
        const currentCampaignIds = new Set(currentCampaigns.map(c => c.campaign_id));
        const desiredCampaignIds = new Set(user.campaignIds || []);

        const campaignsToAdd = [...desiredCampaignIds].filter(id => !currentCampaignIds.has(id));
        const campaignsToRemove = [...currentCampaignIds].filter(id => !desiredCampaignIds.has(id));

        if (campaignsToRemove.length > 0) {
            const placeholders = campaignsToRemove.map((_, i) => `$${i + 2}`).join(',');
            await client.query(`DELETE FROM campaign_agents WHERE user_id = $1 AND campaign_id IN (${placeholders})`, [userId, ...campaignsToRemove]);
        }
        if (campaignsToAdd.length > 0) {
            for (const campaignId of campaignsToAdd) {
                await client.query('INSERT INTO campaign_agents (user_id, campaign_id) VALUES ($1, $2)', [userId, campaignId]);
            }
        }
        
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
    createUser,
    updateUser,
    deleteUser,
};
