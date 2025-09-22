const pool = require('./connection');
const { keysToCamel } = require('./utils');

const authenticateUser = async (loginId, password) => {
    // In a real app, 'password' would be hashed before comparison
    // IMPORTANT: Never select password_hash to send back to client
    const userQuery = `
        SELECT id, login_id, first_name, last_name, email, "role", is_active, site_id, created_at, updated_at 
        FROM users 
        WHERE login_id = $1 AND password_hash = $2
    `;
    const userRes = await pool.query(userQuery, [loginId, password]);
    
    if (userRes.rows.length > 0) {
        const user = keysToCamel(userRes.rows[0]);

        // Fix: Fetch campaign assignments to ensure the user object is complete on login.
        // This prevents crashes in the agent view which expects the campaignIds array.
        const campaignQuery = `SELECT campaign_id FROM campaign_agents WHERE user_id = $1`;
        const campaignRes = await pool.query(campaignQuery, [user.id]);
        user.campaignIds = campaignRes.rows.map(row => row.campaign_id);

        return user;
    }
    return null;
};

module.exports = {
    authenticateUser,
};