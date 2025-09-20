require('dotenv').config();
const fastagi = require('node-fast-agi');
const agiHandler = require('./agi-handler.js');

const port = process.env.AGI_PORT || 4573;

const server = fastagi.createServer(agiHandler);

server.listen(port, () => {
    console.log(`AGI Server listening on port ${port}`);
});

process.on('SIGINT', () => {
    console.log('Shutting down AGI server...');
    server.close();
    process.exit(0);
});