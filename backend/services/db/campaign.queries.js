const pool = require('./connection');
const { keysToCamel } = require('./utils');

const getCampaigns = async () => {
    const res = await pool.query('SELECT * FROM campaigns ORDER BY name');
    return res.rows.map(keysToCamel);
};

const saveCampaign = async (campaign, id) => {
    const { name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime } = campaign;
     if (id) {
        const res = await pool.query(
            'UPDATE campaigns SET name=$1, description=$2, script_id=$3, qualification_group_id=$4, caller_id=$5, is_active=$6, dialing_mode=$7, wrap_up_time=$8, updated_at=NOW() WHERE id=$9 RETURNING *',
            [name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, id]
        );
        return keysToCamel(res.rows[0]);
    }
    const res = await pool.query(
        'INSERT INTO campaigns (id, name, description, script_id, qualification_group_id, caller_id, is_active, dialing_mode, wrap_up_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [campaign.id, name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime]
    );
    return keysToCamel(res.rows[0]);
};

const deleteCampaign = async (id) => await pool.query('DELETE FROM campaigns WHERE id=$1', [id]);

const importContacts = async (campaignId, contacts) => {
     if (!contacts || contacts.length === 0) return [];
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const insertedContacts = [];
        for (const contact of contacts) {
            const res = await client.query(
                'INSERT INTO contacts (id, campaign_id, first_name, last_name, phone_number, postal_code, status, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [contact.id, campaignId, contact.firstName, contact.lastName, contact.phoneNumber, contact.postalCode, 'pending', JSON.stringify(contact.customFields || {})]
            );
            insertedContacts.push(keysToCamel(res.rows[0]));
        }
        await client.query('COMMIT');
        return insertedContacts;
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

module.exports = {
    getCampaigns,
    saveCampaign,
    deleteCampaign,
    importContacts,
};
