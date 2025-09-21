const pool = require('./connection');
const { keysToCamel } = require('./utils');

const getTrunks = async () => (await pool.query('SELECT * FROM trunks ORDER BY name')).rows.map(keysToCamel);
const saveTrunk = async (trunk, id) => { /* ... */ return keysToCamel(trunk); };
const deleteTrunk = async (id) => { /* ... */ };

const getDids = async () => (await pool.query('SELECT * FROM dids ORDER BY number')).rows.map(keysToCamel);
const saveDid = async (did, id) => { /* ... */ return keysToCamel(did); };
const deleteDid = async (id) => { /* ... */ };

module.exports = {
    getTrunks,
    saveTrunk,
    deleteTrunk,
    getDids,
    saveDid,
    deleteDid,
};
