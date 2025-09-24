// --- GLOBAL ERROR HANDLERS ---
// These are crucial for debugging silent crashes.
process.on('uncaughtException', (error) => {
  console.error('FATAL: Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('FATAL: Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});


// --- DEPENDENCIES ---
// Load environment variables from .env file BEFORE any other code runs.
require('dotenv').config();

const express = require('express');
const http = require('http' );
const net = require('net'); // <-- CORRECTION : Ajout du module 'net' pour le serveur AGI
const cors = require('cors');
const Agi = require('asteriskagi'); // <-- CORRECTION : Renommé en 'Agi' (convention pour une classe)
const agiHandler = require('./agi-handler.js');
const db = require('./services/db');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const cookieParser = require('cookie-parser');
const { initializeWebSocketServer } = require('./services/webSocketServer.js');
const { initializeAmiListener } = require('./services/amiListener.js');

// --- INITIALIZATION ---
const app = express();
const server = http.createServer(app );
const PORT = process.env.PORT || 3001;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
// Initialize cookie-parser with a secret to enable signed cookies
app.use(cookieParser(process.env.COOKIE_SECRET));
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
    apis: [
        path.join(__dirname, 'routes/auth.js'),
        path.join(__dirname, 'routes/call.js'),
        path.join(__dirname, 'server.js')
    ],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// --- API ROUTES ---
const authRoutes = require('./routes/auth.js');
const callRoutes = require('./routes/call.js');

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth', authRoutes);
app.use('/api/call', callRoutes);

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
            moduleVisibility: { categories: {}, features: {} },
            backupLogs: [],
            backupSchedule: { frequency: 'daily', time: '02:00' },
            systemLogs: [],
            versionInfo: { application: '1.0.0', asterisk: '18.x', database: '14.x', 'agi': '0.0.1-alpha.3' },
            connectivityServices: [],
            systemConnectionSettings: { database: {}, asterisk: {} }
        });
    } catch (error) {
        console.error("Error fetching application data:", error);
        res.status(500).json({ error: "Failed to load application data." });
    }
});

// --- SERVE FRONTEND ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// --- AGI SERVER (CORRECTED) ---
const agiPort = parseInt(process.env.AGI_PORT || '4573', 10);

// 1. Créez un serveur TCP avec le module 'net' de Node.js
const agiNetServer = net.createServer((socket) => {
    console.log('[AGI] New AGI connection received.');

    // 2. Pour chaque connexion, instanciez 'Agi' en lui passant le handler et le socket
    const agiContext = new Agi(agiHandler, socket);

    agiContext.on('error', (err) => {
        console.error('[AGI] Error on AGI context:', err);
    });

    agiContext.on('close', () => {
        console.log('[AGI] AGI context closed.');
    });

}).on('error', (err) => {
    // Gère les erreurs du serveur TCP lui-même (ex: port déjà utilisé)
    console.error(`[AGI] Critical error on AGI server, port ${agiPort}:`, err);
    throw err;
});

// 3. Démarrez le serveur TCP pour écouter les connexions d'Asterisk
agiNetServer.listen(agiPort, () => {
    console.log(`[AGI] Server listening for connections from Asterisk on port ${agiPort}`);
});


// --- WEBSOCKET & AMI ---
initializeWebSocketServer(server);
initializeAmiListener(); // This function now handles its own errors and retries

// --- START SERVER ---
server.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
});
