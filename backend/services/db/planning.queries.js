const pool = require('./connection');
const { keysToCamel } = require('./utils');

const getPlanningEvents = async () => (await pool.query('SELECT * FROM planning_events')).rows.map(keysToCamel);
const savePlanningEvent = async (event, id) => { /* ... */ return keysToCamel(event); };
const deletePlanningEvent = async (id) => { /* ... */ };
const getActivityTypes = async () => (await pool.query('SELECT * FROM activity_types ORDER BY name')).rows.map(keysToCamel);
const getPersonalCallbacks = async () => (await pool.query('SELECT * FROM personal_callbacks')).rows.map(keysToCamel);

module.exports = {
    getPlanningEvents,
    savePlanningEvent,
    deletePlanningEvent,
    getActivityTypes,
    getPersonalCallbacks,
};
