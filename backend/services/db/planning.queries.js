const pool = require('./connection');
const { keysToCamel } = require('./utils');

const getPlanningEvents = async () => (await pool.query('SELECT * FROM planning_events')).rows.map(keysToCamel);

const savePlanningEvent = async (event, id) => {
    const { agentId, activityId, startDate, endDate } = event;
    if (id) {
        const res = await pool.query(
            'UPDATE planning_events SET agent_id=$1, activity_id=$2, start_date=$3, end_date=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
            [agentId, activityId, startDate, endDate, id]
        );
        return keysToCamel(res.rows[0]);
    }
    const res = await pool.query(
        'INSERT INTO planning_events (id, agent_id, activity_id, start_date, end_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [event.id, agentId, activityId, startDate, endDate]
    );
    return keysToCamel(res.rows[0]);
};

const deletePlanningEvent = async (id) => await pool.query('DELETE FROM planning_events WHERE id=$1', [id]);

const getActivityTypes = async () => (await pool.query('SELECT * FROM activity_types ORDER BY name')).rows.map(keysToCamel);

const getPersonalCallbacks = async () => (await pool.query('SELECT * FROM personal_callbacks')).rows.map(keysToCamel);

const createPersonalCallback = async (callbackData) => {
    const { agentId, contactId, campaignId, scheduledTime, notes } = callbackData;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Create the personal callback
        const callbackQuery = `
            INSERT INTO personal_callbacks (id, agent_id, contact_id, campaign_id, scheduled_time, notes)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;
        `;
        const callbackId = `cb-${Date.now()}`;
        const callbackRes = await client.query(callbackQuery, [callbackId, agentId, contactId, campaignId, scheduledTime, notes]);
        
        // 2. Create the corresponding planning event
        const scheduledDate = new Date(scheduledTime);
        const endDate = new Date(scheduledDate.getTime() + 15 * 60000); // Add 15 minutes for the event duration
        const eventId = `plan-cb-${Date.now()}`;
        const activityId = 'act-callback'; // Predefined ID for personal callbacks activity type

        const eventQuery = `
            INSERT INTO planning_events (id, agent_id, activity_id, start_date, end_date)
            VALUES ($1, $2, $3, $4, $5);
        `;
        await client.query(eventQuery, [eventId, agentId, activityId, scheduledDate.toISOString(), endDate.toISOString()]);
        
        await client.query('COMMIT');
        return keysToCamel(callbackRes.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error creating personal callback and planning event:", e);
        throw e;
    } finally {
        client.release();
    }
};

module.exports = {
    getPlanningEvents,
    savePlanningEvent,
    deletePlanningEvent,
    getActivityTypes,
    getPersonalCallbacks,
    createPersonalCallback,
};