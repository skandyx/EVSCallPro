const pool = require('./connection');
const { keysToCamel } = require('./utils');

const getCampaigns = async () => {
    // We get all campaigns and enrich them with assigned user IDs in a separate step
    // to keep the query simple and avoid complex aggregations.
    const campaignsRes = await pool.query('SELECT * FROM campaigns ORDER BY name');
    const agentsRes = await pool.query('SELECT campaign_id, user_id FROM campaign_agents');
    
    const campaigns = campaignsRes.rows.map(keysToCamel);
    
    campaigns.forEach(campaign => {
        campaign.assignedUserIds = agentsRes.rows
            .filter(row => row.campaign_id === campaign.id)
            .map(row => row.user_id);
        
        // Contacts are now loaded on demand or in a separate query
        campaign.contacts = [];
    });
    
    return campaigns;
};

const getCampaignContacts = async (campaignId) => {
    const res = await pool.query('SELECT * FROM contacts WHERE campaign_id = $1', [campaignId]);
    return res.rows.map(keysToCamel);
};

const saveCampaign = async (campaign, id) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const {
            name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode,
            wrapUpTime, quotaRules, filterRules, assignedUserIds
        } = campaign;

        let savedCampaign;
        if (id) {
            const res = await client.query(
                `UPDATE campaigns SET name=$1, description=$2, script_id=$3, qualification_group_id=$4, caller_id=$5, is_active=$6, dialing_mode=$7, wrap_up_time=$8, quota_rules=$9, filter_rules=$10, updated_at=NOW()
                 WHERE id=$11 RETURNING *`,
                [name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, JSON.stringify(quotaRules), JSON.stringify(filterRules), id]
            );
            savedCampaign = res.rows[0];
        } else {
            const res = await client.query(
                `INSERT INTO campaigns (id, name, description, script_id, qualification_group_id, caller_id, is_active, dialing_mode, wrap_up_time, quota_rules, filter_rules)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
                [campaign.id, name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, JSON.stringify(quotaRules), JSON.stringify(filterRules)]
            );
            savedCampaign = res.rows[0];
        }

        const campaignId = savedCampaign.id;

        // Sync assigned agents
        await client.query('DELETE FROM campaign_agents WHERE campaign_id = $1', [campaignId]);
        if (assignedUserIds && assignedUserIds.length > 0) {
            for (const userId of assignedUserIds) {
                await client.query('INSERT INTO campaign_agents (user_id, campaign_id) VALUES ($1, $2)', [userId, campaignId]);
            }
        }
        
        await client.query('COMMIT');
        return keysToCamel(savedCampaign);
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const deleteCampaign = async (id) => {
    // In a real app, we should check if the campaign has active calls.
    // For now, we allow deletion if it's just configuration.
    await pool.query('DELETE FROM campaigns WHERE id = $1', [id]);
};

const importContacts = async (campaignId, contacts) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const contact of contacts) {
            const query = `
                INSERT INTO contacts (id, campaign_id, first_name, last_name, phone_number, postal_code, status, custom_fields)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;
            await client.query(query, [
                contact.id, campaignId, contact.firstName, contact.lastName, contact.phoneNumber, 
                contact.postalCode, 'pending', JSON.stringify(contact.customFields || {})
            ]);
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const updateContact = async (contact) => {
    const query = `
        UPDATE contacts SET first_name=$1, last_name=$2, phone_number=$3, postal_code=$4, status=$5, custom_fields=$6, updated_at=NOW()
        WHERE id = $7 RETURNING *
    `;
    const res = await pool.query(query, [
        contact.firstName, contact.lastName, contact.phoneNumber, contact.postalCode, contact.status,
        JSON.stringify(contact.customFields || {}), contact.id
    ]);
    return keysToCamel(res.rows[0]);
};

const deleteContacts = async (contactIds) => {
    await pool.query('DELETE FROM contacts WHERE id = ANY($1::text[])', [contactIds]);
};

const getNextContactForCampaign = async (agentId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find the next available contact for any campaign the agent is assigned to.
        // It locks the row to prevent other agents from picking it up.
        const findQuery = `
            SELECT ct.id
            FROM contacts ct
            JOIN campaign_agents ca ON ct.campaign_id = ca.campaign_id
            WHERE ca.user_id = $1 AND ct.status = 'pending'
            ORDER BY ct.created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED;
        `;
        const { rows } = await client.query(findQuery, [agentId]);

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return null; // No contacts available
        }
        
        const contactId = rows[0].id;
        
        // Mark the contact as 'called' to lock it and retrieve its full data.
        const updateQuery = `
            UPDATE contacts
            SET status = 'called', updated_at = NOW()
            WHERE id = $1
            RETURNING *;
        `;
        const updateRes = await client.query(updateQuery, [contactId]);
        const contact = updateRes.rows[0];

        // Also fetch the campaign data for context
        const campaignRes = await client.query('SELECT * FROM campaigns WHERE id = $1', [contact.campaign_id]);
        
        await client.query('COMMIT');

        return {
            contact: keysToCamel(contact),
            campaign: keysToCamel(campaignRes.rows[0]),
        };

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error in getNextContactForCampaign transaction:", e);
        throw e;
    } finally {
        client.release();
    }
};


module.exports = {
    getCampaigns,
    getCampaignContacts,
    saveCampaign,
    deleteCampaign,
    importContacts,
    updateContact,
    deleteContacts,
    getNextContactForCampaign,
};
