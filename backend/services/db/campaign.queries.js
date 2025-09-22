const pool = require('./connection');
const { keysToCamel } = require('./utils');

const getCampaigns = async () => {
    const res = await pool.query('SELECT * FROM campaigns ORDER BY name');
    return res.rows.map(keysToCamel);
};

const saveCampaign = async (campaign, id) => {
    const { name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, quotaRules, filterRules } = campaign;
    const quotaRulesJson = JSON.stringify(quotaRules || []);
    const filterRulesJson = JSON.stringify(filterRules || []);

     if (id) {
        const res = await pool.query(
            'UPDATE campaigns SET name=$1, description=$2, script_id=$3, qualification_group_id=$4, caller_id=$5, is_active=$6, dialing_mode=$7, wrap_up_time=$8, quota_rules=$9, filter_rules=$10, updated_at=NOW() WHERE id=$11 RETURNING *',
            [name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, quotaRulesJson, filterRulesJson, id]
        );
        return keysToCamel(res.rows[0]);
    }
    const res = await pool.query(
        'INSERT INTO campaigns (id, name, description, script_id, qualification_group_id, caller_id, is_active, dialing_mode, wrap_up_time, quota_rules, filter_rules) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
        [campaign.id, name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, quotaRulesJson, filterRulesJson]
    );
    return keysToCamel(res.rows[0]);
};

const deleteCampaign = async (id) => {
    const checkRes = await pool.query('SELECT is_active FROM campaigns WHERE id = $1', [id]);
    if (checkRes.rows.length > 0 && checkRes.rows[0].is_active) {
        throw new Error('Impossible de supprimer une campagne active. Veuillez d\'abord la désactiver.');
    }
    await pool.query('DELETE FROM campaigns WHERE id=$1', [id]);
};

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

const createSingleContact = async (campaignId, contactData, phoneNumber) => {
    const contact = {
        id: `contact-${Date.now()}`,
        campaign_id: campaignId,
        first_name: '',
        last_name: '',
        phone_number: phoneNumber,
        postal_code: '',
        status: 'pending',
        custom_fields: contactData,
    };

    // Heuristique pour peupler les champs standards à partir des champs personnalisés
    for (const key in contact.custom_fields) {
        const value = contact.custom_fields[key];
        if (typeof value !== 'string') continue;

        const lowerKey = key.toLowerCase();
        if (!contact.first_name && (lowerKey.includes('prenom') || lowerKey.includes('first'))) {
            contact.first_name = value;
        }
        if (!contact.last_name && (lowerKey.includes('nom') || lowerKey.includes('last'))) {
            contact.last_name = value;
        }
        if (!contact.postal_code && (lowerKey.includes('postal') || lowerKey.includes('cp'))) {
            contact.postal_code = value;
        }
    }

    if (!contact.first_name && !contact.last_name) {
        contact.last_name = `Contact ${phoneNumber}`;
    }

    const res = await pool.query(
        'INSERT INTO contacts (id, campaign_id, first_name, last_name, phone_number, postal_code, status, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [contact.id, contact.campaign_id, contact.first_name, contact.last_name, contact.phone_number, contact.postal_code, contact.status, JSON.stringify(contact.custom_fields)]
    );
    return keysToCamel(res.rows[0]);
};

const updateContact = async (contactId, contactData) => {
    const { customFields, ...standardFields } = contactData;
    // We don't want to update these from the generic form
    delete standardFields.id;
    delete standardFields.campaignId;
    delete standardFields.status;

    const standardFieldEntries = Object.entries(standardFields);
    
    const setClauses = standardFieldEntries.map(([key], i) => 
        `${key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)} = $${i + 2}`
    );

    const queryParams = [contactId, ...standardFieldEntries.map(([, value]) => value)];

    if (customFields && typeof customFields === 'object') {
        setClauses.push(`custom_fields = $${queryParams.length + 1}`);
        queryParams.push(JSON.stringify(customFields));
    }

    if (setClauses.length === 0) {
        // Nothing to update, just return the existing contact
        const res = await pool.query('SELECT * FROM contacts WHERE id = $1', [contactId]);
        return keysToCamel(res.rows[0]);
    }
    
    const query = `UPDATE contacts SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const res = await pool.query(query, queryParams);
    return keysToCamel(res.rows[0]);
};


const deleteContacts = async (contactIds) => {
    if (!contactIds || contactIds.length === 0) return;
    await pool.query('DELETE FROM contacts WHERE id = ANY($1::text[])', [contactIds]);
};


module.exports = {
    getCampaigns,
    saveCampaign,
    deleteCampaign,
    importContacts,
    createSingleContact,
    updateContact,
    deleteContacts,
};