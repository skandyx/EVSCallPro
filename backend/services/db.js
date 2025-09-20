const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

/**
 * Fetches an IVR flow from the database based on the dialed number (DNID).
 * It looks up the number in the `dids` table to find the associated `ivr_flow_id`.
 * @param {string} dnid The dialed number.
 * @returns {Promise<object|null>} The IVR flow object or null if not found.
 */
async function getIvrFlowByDnid(dnid) {
  console.log(`Looking up IVR flow for number: ${dnid}`);
  
  const lookupQuery = `
    SELECT ivr_flow_id 
    FROM dids 
    WHERE "number" = $1;
  `;

  try {
    const lookupRes = await pool.query(lookupQuery, [dnid]);
    
    if (lookupRes.rows.length === 0) {
      console.log(`No DID entry found for number: ${dnid}`);
      return null;
    }
    
    const ivrFlowId = lookupRes.rows[0].ivr_flow_id;

    if (!ivrFlowId) {
      console.log(`DID entry for ${dnid} is not assigned to an IVR flow.`);
      return null;
    }

    console.log(`Found IVR Flow ID: ${ivrFlowId}. Fetching flow details.`);

    const flowQuery = `
      SELECT id, name, nodes, connections 
      FROM ivr_flows 
      WHERE id = $1;
    `;
    
    const flowRes = await pool.query(flowQuery, [ivrFlowId]);

    if (flowRes.rows.length > 0) {
      console.log('Found IVR flow:', flowRes.rows[0].name);
      return flowRes.rows[0];
    }
    
    console.warn(`Could not find IVR flow with ID: ${ivrFlowId}, although it was assigned to DID ${dnid}.`);
    return null;

  } catch (err) {
    console.error('Error fetching IVR flow from database:', err);
    return null;
  }
}

module.exports = {
  getIvrFlowByDnid,
};
