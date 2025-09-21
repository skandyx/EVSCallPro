const pool = require('./connection');
const { keysToCamel } = require('./utils');

const getSites = async () => (await pool.query('SELECT * FROM sites ORDER BY name')).rows.map(keysToCamel);
const saveSite = async (site, id) => { /* ... */ return keysToCamel(site); };
const deleteSite = async (id) => { /* ... */ };

module.exports = {
    getSites,
    saveSite,
    deleteSite,
};
