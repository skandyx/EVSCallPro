const pool = require('./connection');
const { keysToCamel } = require('./utils');

const getSites = async () => (await pool.query('SELECT * FROM sites ORDER BY name')).rows.map(keysToCamel);

const saveSite = async (site, id) => {
    const { name, yeastarIp, apiUser, apiPassword } = site;
    if (id) {
        const res = await pool.query(
            'UPDATE sites SET name=$1, yeastar_ip=$2, api_user=$3, api_password=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
            [name, yeastarIp, apiUser, apiPassword, id]
        );
        return keysToCamel(res.rows[0]);
    }
    const res = await pool.query(
        'INSERT INTO sites (id, name, yeastar_ip, api_user, api_password) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [site.id, name, yeastarIp, apiUser, apiPassword]
    );
    return keysToCamel(res.rows[0]);
};

const deleteSite = async (id) => await pool.query('DELETE FROM sites WHERE id=$1', [id]);

module.exports = {
    getSites,
    saveSite,
    deleteSite,
};