// backend/services/db/pbx.queries.js
const pool = require('./connection');
const { keysToCamel } = require('./utils');

const getPbxConfigBySiteId = async (siteId) => {
    const query = `
        SELECT id, site_id, ip_address, api_user, api_password_encrypted, api_version 
        FROM pbx_configs 
        WHERE site_id = $1
    `;
    const res = await pool.query(query, [siteId]);
    if (res.rows.length > 0) {
        return keysToCamel(res.rows[0]);
    }
    return null;
};

const getAllPbxConfigs = async () => {
    const query = `
        SELECT id, site_id, ip_address, api_user, api_password_encrypted, api_version 
        FROM pbx_configs
    `;
    const res = await pool.query(query);
    return res.rows.map(keysToCamel);
};

const updatePbxApiVersion = async (pbxId, version) => {
    const query = 'UPDATE pbx_configs SET api_version = $1, updated_at = NOW() WHERE id = $2';
    await pool.query(query, [version, pbxId]);
};


module.exports = {
    getPbxConfigBySiteId,
    getAllPbxConfigs,
    updatePbxApiVersion,
};