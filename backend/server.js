// --- DEPENDENCIES ---
const express = require('express');
const http = require('http');
const cors = require('cors');
const { AGI } = require('asterisk-agi-plus'); // Remplacement de fast-agi
const agiHandler = require('./agi-handler.js');
const db = require('./services/db');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const cookieParser = require('cookie-parser');

// --- INITIALIZATION ---
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'dist')));

// --- SWAGGER CONFIGURATION ---
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'EVSCallPro API',
            version: '1.0.0',
            description: 'API pour la solution de centre de contact EVSCallPro, permettant de gérer toutes les ressources de l\'application.',
        },
        servers: [{ url: `/api` }],
    },
    apis: ['./backend/routes/*.js', './backend/server.js'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// --- API ROUTES ---
const authRoutes = require('./backend/routes/auth.js');
const callRoutes = require('./backend/routes/call.js');
// ... other routes will be added here

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth', authRoutes);
app.use('/api/call', callRoutes);
// ... other routes usage

/**
 * @openapi
 * /application-data:
 *   get:
 *     summary: Récupère toutes les données nécessaires au démarrage de l'application.
 *     tags: [Application]
 *     responses:
 *       200:
 *         description: Un objet contenant toutes les collections de données.
 */
app.get('/api/application-data', async (req, res) => {
    try {
        const [
            users, userGroups, savedScripts, campaigns, qualifications,
            qualificationGroups, ivrFlows, audioFiles, trunks, dids, sites,
            planningEvents, activityTypes, personalCallbacks, callHistory, agentSessions,
            contactNotes
        ] = await Promise.all([
            db.getUsers(), db.getUserGroups(), db.getScripts(), db.getCampaigns(),
            db.getQualifications(), db.getQualificationGroups(), db.getIvrFlows(),
            db.getAudioFiles(), db.getTrunks(), db.getDids(), db.getSites(),
            db.getPlanningEvents(), db.getActivityTypes(), db.getPersonalCallbacks(),
            db.getCallHistory(), db.getAgentSessions(), db.getContactNotes()
        ]);

        res.json({
            users, userGroups, savedScripts, campaigns, qualifications,
            qualificationGroups, ivrFlows, audioFiles, trunks, dids, sites,
            planningEvents, activityTypes, personalCallbacks, callHistory, agentSessions,
            contactNotes,
            // Mocked/Static data for now
            moduleVisibility: { categories: {}, features: {} },
            backupLogs: [],
            backupSchedule: { frequency: 'daily', time: '02:00' },
            systemLogs: [],
            versionInfo: { application: '1.0.0', asterisk: '18.x', database: '14.x', 'asterisk-agi-plus': '0.6.0' },
            connectivityServices: [],
            systemConnectionSettings: { database: {}, asterisk: {} }
        });
    } catch (error) {
        console.error("Error fetching application data:", error);
        res.status(500).json({ error: "Failed to load application data." });
    }
});

// Generic CRUD routes will be added here

// --- SERVE FRONTEND ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// --- AGI SERVER ---
// asterisk-agi-plus s'initialise et écoute directement sur le port spécifié.
new AGI(agiHandler, { port: parseInt(process.env.AGI_PORT || '4573', 10) });
console.log(`AGI server listening on port ${process.env.AGI_PORT || 4573}`);

// --- WEBSOCKET & AMI (Conditional Start) ---
if (process.env.PBX_CONNECTION_MODE === 'ASTERISK_AMI') {
    const { initializeWebSocketServer } = require('./backend/services/webSocketServer.js');
    const { initializeAmiListener } = require('./backend/services/amiListener.js');
    
    const wsServer = initializeWebSocketServer(server);
    initializeAmiListener(wsServer);
    console.log('Running in ASTERISK_AMI mode. WebSocket and AMI Listener initialized.');
} else {
    console.log(`Running in ${process.env.PBX_CONNECTION_MODE || 'YEASTAR_API'} mode. WebSocket and AMI Listener are disabled.`);
}

// --- START SERVER ---
server.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
});