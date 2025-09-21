const pool = require('./connection');
const { keysToCamel } = require('./utils');

const getAudioFiles = async () => (await pool.query('SELECT * FROM audio_files ORDER BY name')).rows.map(keysToCamel);
const saveAudioFile = async (file, id) => { /* ... */ return keysToCamel(file); };
const deleteAudioFile = async (id) => { /* ... */ };

module.exports = {
    getAudioFiles,
    saveAudioFile,
    deleteAudioFile,
};
