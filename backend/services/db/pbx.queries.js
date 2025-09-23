const pool = require('./connection');
const { keysToCamel } = require('./utils');

/**
 * Récupère la configuration d'un PBX pour un site donné.
 * @param {string} siteId - L'ID du site.
 * @returns {Promise<object|null>} La configuration du PBX ou null si non trouvée.
 */
const getPbxConfigBySiteId = async (siteId) => {
    const query = 'SELECT * FROM pbx_configs WHERE site_id = $1';
    const res = await pool.query(query, [siteId]);
    if (res.rows.length > 0) {
        return keysToCamel(res.rows[0]);
    }
    return null;
};

/**
 * Met à jour la version de l'API détectée pour un PBX.
 * @param {string} pbxId - L'ID de la configuration PBX.
 * @param {number} version - La version de l'API (1 ou 2).
 * @returns {Promise<void>}
 */
const updatePbxApiVersion = async (pbxId, version) => {
    const query = 'UPDATE pbx_configs SET api_version = $1, updated_at = NOW() WHERE id = $2';
    await pool.query(query, [version, pbxId]);
};


module.exports = {
    getPbxConfigBySiteId,
    updatePbxApiVersion,
};
