const pool = require('./connection');
const { keysToCamel } = require('./utils');

const getQualifications = async () => (await pool.query('SELECT * FROM qualifications ORDER BY code')).rows.map(keysToCamel);
const getQualificationGroups = async () => (await pool.query('SELECT * FROM qualification_groups ORDER BY name')).rows.map(keysToCamel);

const saveQualification = async (q, id) => {
    if (id) {
        const res = await pool.query('UPDATE qualifications SET code=$1, description=$2, type=$3, parent_id=$4, updated_at=NOW() WHERE id=$5 RETURNING *', [q.code, q.description, q.type, q.parentId, id]);
        return keysToCamel(res.rows[0]);
    }
    const res = await pool.query('INSERT INTO qualifications (id, code, description, type, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING *', [q.id, q.code, q.description, q.type, q.parentId]);
    return keysToCamel(res.rows[0]);
};

const deleteQualification = async (id) => await pool.query('DELETE FROM qualifications WHERE id=$1', [id]);

const saveQualificationGroup = async (group, assignedQualIds, id) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let savedGroup;
        if (id) {
            const res = await client.query('UPDATE qualification_groups SET name=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [group.name, id]);
            savedGroup = res.rows[0];
        } else {
            const res = await client.query('INSERT INTO qualification_groups (id, name) VALUES ($1, $2) RETURNING *', [group.id, group.name]);
            savedGroup = res.rows[0];
        }
        
        await client.query('UPDATE qualifications SET group_id = NULL WHERE group_id = $1', [savedGroup.id]);
        if (assignedQualIds && assignedQualIds.length > 0) {
            const placeholders = assignedQualIds.map((_, i) => `$${i + 2}`).join(',');
            await client.query(`UPDATE qualifications SET group_id = $1 WHERE id IN (${placeholders})`, [savedGroup.id, ...assignedQualIds]);
        }
        
        await client.query('COMMIT');
        return keysToCamel(savedGroup);
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const deleteQualificationGroup = async (id) => await pool.query('DELETE FROM qualification_groups WHERE id=$1', [id]);

module.exports = {
    getQualifications,
    getQualificationGroups,
    saveQualification,
    deleteQualification,
    saveQualificationGroup,
    deleteQualificationGroup,
};
