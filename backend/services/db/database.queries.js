
const pool = require('./connection');

const getDatabaseSchema = async () => {
    const query = `
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
    `;
    const res = await pool.query(query);
    const schema = {};
    res.rows.forEach(row => {
        if (!schema[row.table_name]) {
            schema[row.table_name] = [];
        }
        schema[row.table_name].push(row.column_name); 
    });
    return schema;
};

module.exports = {
    getDatabaseSchema,
};
