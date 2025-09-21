const pool = require('./connection');
const { keysToCamel } = require('./utils');

const authenticateUser = async (loginId, password) => {
    // In a real app, 'password' would be hashed before comparison
    const res = await pool.query('SELECT * FROM users WHERE login_id = $1 AND password_hash = $2', [loginId, password]);
    if (res.rows.length > 0) {
        return keysToCamel(res.rows[0]);
    }
    return null;
};

module.exports = {
    authenticateUser,
};
