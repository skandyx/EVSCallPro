require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const http = require('http');
const WebSocket = require('ws');
const FastAGI = require('fastagi');
const db = require('./services/db');
const agiHandler = require('./agi-handler.js');

// Import des routeurs
const authRoutes = require('./routes/auth');
const callRoutes = require('./routes/call');
// ... d'autres routeurs seront ajoutés ici

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3001;
const AGI_PORT = process.env.AGI_PORT || 4573;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration Swagger
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'EVSCallPro API',
            version: '1.0.0',
            description: 'API pour la solution de centre de contact EVSCallPro, permettant de gerer toutes les ressources de l\'application.',
        },
        servers: [
            {
                url: `http://localhost:${PORT}/api`,
            },
        ],
    },
    apis: ['./routes/*.js'],
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));


// --- ROUTES API ---

app.use('/api', authRoutes);
app.use('/api/call', callRoutes);


// Endpoint central pour charger toutes les données de l'application
app.get('/api/application-data', async (req, res) => {
    try {
        const [
            users, userGroups, campaigns, savedScripts, qualifications, qualificationGroups,
            sites, trunks, dids, savedIvrFlows, audioFiles, planningEvents, activityTypes,
            personalCallbacks, systemConnectionSettings, callHistory, agentSessions
        ] = await Promise.all([
            db.getUsers(), db.getUserGroups(), db.getCampaigns(), db.getScripts(),
            db.getQualifications(), db.getQualificationGroups(), db.getSites(),
            db.getTrunks(), db.getDids(), db.getIvrFlows(), db.getAudioFiles(),
            db.getPlanningEvents(), db.getActivityTypes(), db.getPersonalCallbacks(),
            Promise.resolve({}), // systemConnectionSettings (mocked for now)
            Promise.resolve([]), // callHistory (reporting)
            Promise.resolve([])  // agentSessions (reporting)
        ]);
        
        // Enrichir les données
        const enrichedUsers = users.map(u => ({ ...u, campaignIds: campaigns.filter(c => c.assignedUserIds.includes(u.id)).map(c => c.id) }));
        const enrichedGroups = userGroups.map(g => ({...g, memberIds: users.filter(u => userGroups.find(ug => ug.id === g.id)).map(u => u.id)}));


        res.json({
            users: enrichedUsers,
            userGroups: enrichedGroups,
            campaigns,
            savedScripts,
            qualifications,
            qualificationGroups,
            sites,
            trunks,
            dids,
            savedIvrFlows,
            audioFiles,
            planningEvents,
            activityTypes,
            personalCallbacks,
            systemConnectionSettings,
            callHistory,
            agentSessions,
            // Données statiques pour le monitoring
            systemLogs: [],
            versionInfo: { application: '1.0.0-backend' },
            connectivityServices: [],
            backupLogs: [],
            backupSchedule: { frequency: 'daily', time: '02:00' },
        });

    } catch (error) {
        console.error('Failed to fetch application data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// --- GESTION DES WEBSOCKETS (pour la supervision) ---
wss.on('connection', ws => {
    console.log('Client de supervision connecté');
    ws.on('close', () => console.log('Client de supervision déconnecté'));
});

// Fonction pour diffuser les événements à tous les clients de supervision
const broadcast = (data) => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
};


// --- DÉMARRAGE CONDITIONNEL DES SERVICES DE TÉLÉPHONIE ---
if (process.env.PBX_CONNECTION_MODE === 'ASTERISK_AMI') {
    console.log('Mode de connexion: ASTERISK_AMI');
    // const AmiListener = require('./services/amiListener');
    // const amiListener = new AmiListener(broadcast);
    // amiListener.connect();

    // Démarrer le serveur AGI
    const agiServer = new FastAGI(agiHandler, AGI_PORT);
    console.log(`Serveur AGI démarré sur le port ${AGI_PORT}`);

} else {
    console.log('Mode de connexion: YEASTAR_API (polling)');
    // const PbxPoller = require('./services/pbxPoller');
    // const pbxPoller = new PbxPoller(broadcast);
    // pbxPoller.start();
}


// Démarrage du serveur principal
server.listen(PORT, () => {
    console.log(`Serveur backend EVSCallPro démarré sur http://localhost:${PORT}`);
    console.log(`Documentation API disponible sur http://localhost:${PORT}/api/docs`);
});

module.exports = { app, broadcast };
