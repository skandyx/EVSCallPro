require('dotenv').config();
const AGI = require('fast-agi').default;
const agiHandler = require('./agi-handler.js');

const port = process.env.AGI_PORT || 4573;

const agi = new AGI({
    port: port,
}, agiHandler);

console.log(`AGI Server listening on port ${port}`);

process.on('SIGINT', () => {
    console.log('Shutting down AGI server...');
    agi.close();
    process.exit(0);
});
