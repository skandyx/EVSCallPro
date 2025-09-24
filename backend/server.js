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
const http = require('http');
const net = require('net');
const cors = require('cors');
const Agi = require('asteriskagi');
const agiHandler = require('./agi-handler.js');
const db = require('./services/db');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const cookieParser = require('cookie-parser');
const { initializeWebSocketServer } = require('./services/webSocketServer.js');
const { initializeAmiListener } = require('./services/amiListener.js');
const os = require('os');
const fs = require('fs/promises');


// --- INITIALIZATION ---
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.static(path.join(__dirname, '..', 'dist')));

// --- SWAGGER CONFIGURATION ---
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'EVSCallPro API',
            version: '1.0.0',
            description: 'API pour la solution de centre de contact EVSCallPro.',
        },
        servers: [{ url: `/api` }],
    },
    apis: [
        './backend/routes/*.js',
        './backend/server.js'
    ],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// --- API ROUTES ---
app.use('/api/auth', require('./routes/auth.js'));
app.use('/api/call', require('./routes/call.js'));
app.use('/api/users', require('./routes/users.js'));
app.use('/api/user-groups', require('./routes/groups.js'));
app.use('/api/campaigns', require('./routes/campaigns.js'));
app.use('/api/scripts', require('./routes/scripts.js'));
app.use('/api/qualifications', require('./routes/qualifications.js'));
app.use('/api/qualification-groups', require('./routes/qualifications.js'));
app.use('/api/ivr-flows', require('./routes/ivr.js'));
app.use('/api/trunks', require('./routes/telephony.js'));
app.use('/api/dids', require('./routes/telephony.js'));
app.use('/api/sites', require('./routes/sites.js'));
app.use('/api/planning-events', require('./routes/planning.js'));
app.use('/api/contacts', require('./routes/contacts.js'));

// --- SPECIAL SYSTEM ROUTES ---
/**
 * @openapi
 * /api/application-data:
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
        
        const systemConnectionSettings = {
            database: {
                host: process.env.DB_HOST || '',
                port: parseInt(process.env.DB_PORT || '5432'),
                user: process.env.DB_USER || '',
                database: process.env.DB_NAME || '',
            },
            asterisk: {
                amiHost: process.env.AMI_HOST || '',
                amiPort: parseInt(process.env.AMI_PORT || '5038'),
                amiUser: process.env.AMI_USER || '',
                agiPort: parseInt(process.env.AGI_PORT || '4573'),
            }
        };

        res.json({
            users, userGroups, savedScripts, campaigns, qualifications,
            qualificationGroups, ivrFlows, audioFiles, trunks, dids, sites,
            planningEvents, activityTypes, personalCallbacks, callHistory, agentSessions,
            contactNotes,
            systemConnectionSettings,
            moduleVisibility: { categories: {}, features: {} },
            backupLogs: [],
            backupSchedule: { frequency: 'daily', time: '02:00' },
            systemLogs: [],
            versionInfo: { application: '1.0.0', asterisk: '18.x', database: '14.x', 'asteriskagi': '1.2.2' },
            connectivityServices: [
                { id: 'db', name: 'Base de Données', target: `${process.env.DB_HOST}:${process.env.DB_PORT}` },
                { id: 'ami', name: 'Asterisk AMI', target: `${process.env.AMI_HOST}:${process.env.AMI_PORT}` },
            ],
        });
    } catch (error) {
        console.error("Error fetching application data:", error);
        res.status(500).json({ error: "Failed to load application data." });
    }
});

app.post('/api/system-connection', async (req, res) => {
    try {
        const settings = req.body;
        // This is simplified. A real app would write to a secure config store.
        let envContent = await fs.readFile('.env', 'utf-8');
        const updates = {
            DB_HOST: settings.database.host,
            DB_PORT: settings.database.port,
            DB_USER: settings.database.user,
            DB_NAME: settings.database.database,
            ...(settings.database.password && { DB_PASSWORD: settings.database.password }),
            AMI_HOST: settings.asterisk.amiHost,
            AMI_PORT: settings.asterisk.amiPort,
            AMI_USER: settings.asterisk.amiUser,
            ...(settings.asterisk.amiPassword && { AMI_SECRET: settings.asterisk.amiPassword }),
            AGI_PORT: settings.asterisk.agiPort,
        };
        for(const [key, value] of Object.entries(updates)) {
            const regex = new RegExp(`^${key}=.*`, 'm');
            if (envContent.match(regex)) {
                envContent = envContent.replace(regex, `${key}=${value}`);
            } else {
                envContent += `\n${key}=${value}`;
            }
        }
        await fs.writeFile('.env', envContent);
        res.json({ message: 'Settings saved. Restart the application to apply changes.' });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save settings." });
    }
});

// AGI SERVER
const agiPort = parseInt(process.env.AGI_PORT || '4573', 10);
const agiNetServer = net.createServer((socket) => {
    console.log('[AGI] New AGI connection received.');
    const agiContext = new Agi(agiHandler, socket);
    agiContext.on('error', (err) => console.error('[AGI] Error on AGI context:', err));
    agiContext.on('close', () => console.log('[AGI] AGI context closed.'));
}).on('error', (err) => {
    console.error(`[AGI] Critical error on AGI server, port ${agiPort}:`, err);
    throw err;
});
agiNetServer.listen(agiPort, () => {
    console.log(`[AGI] Server listening for connections from Asterisk on port ${agiPort}`);
});

// --- WEBSOCKET & AMI ---
initializeWebSocketServer(server);
initializeAmiListener();

// --- SERVE FRONTEND ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// --- START SERVER ---
server.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
});
