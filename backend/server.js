require('dotenv').config();
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;
const WebSocket = require('ws');
const FastAGI = require('fastagi');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const si = require('systeminformation');
const agiHandler = require('./agi-handler.js');
const db = require('./services/db');

// --- [NOUVEAU] Logique de bascule entre les modes de connexion PBX ---
const PBX_CONNECTION_MODE = process.env.PBX_CONNECTION_MODE || 'asterisk_ami';
console.log(`[SYSTEM] Démarrage en mode de connexion PBX : ${PBX_CONNECTION_MODE}`);

// Importation conditionnelle des services
let pbxService;
let asteriskRouter;
if (PBX_CONNECTION_MODE === 'asterisk_ami') {
    const AmiListener = require('./services/amiListener.js');
    asteriskRouter = require('./services/asteriskRouter.js');
    pbxService = new AmiListener(); // Initialisation sans connexion
} else {
    const PbxPoller = require('./services/pbxPoller.js');
    pbxService = new PbxPoller(db); // Initialisation avec db
}


const AGI_PORT = process.env.AGI_PORT || 4573;
const API_PORT = process.env.API_PORT || 3001;

// --- AGI Server for Asterisk ---
const agiServer = FastAGI.createServer(agiHandler);
agiServer.listen(AGI_PORT, () => {
    console.log(`AGI Server listening on port ${AGI_PORT}`);
});

// --- API Server for Frontend ---
const app = express();
const server = http.createServer(app); // Create HTTP server for Express and WebSocket
app.use(cors());
app.use(express.json());

// --- WebSocket Server for Real-time Supervision ---
const wss = new WebSocket.Server({ noServer: true });
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});
console.log('WebSocket Server initialized.');

// --- PBX Service Initialisation ---
// Le service (Poller ou Listener) est démarré avec la référence au serveur WebSocket
pbxService.start(wss);
if (PBX_CONNECTION_MODE === 'asterisk_ami') {
    asteriskRouter.initializeAmi();
}


// --- Swagger / OpenAPI Configuration ---
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EVSCallPro API',
      version: '1.0.0',
      description: 'API pour la solution de centre de contact EVSCallPro, permettant de gérer toutes les ressources de l''application.',
    },
    servers: [
      {
        url: '/api',
        description: 'Serveur principal',
      },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
    },
    security: [
        {
            bearerAuth: [],
        },
    ],
  },
  apis: [path.resolve(__dirname, 'server.js'), path.resolve(__dirname, 'routes/*.js')], 
};

const openapiSpecification = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpecification));

// --- Security: Simple In-Memory Session Store ---
const sessionStore = new Map(); // { token -> user }

// --- Security: Authentication Middleware ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Accès non autorisé : Token manquant.' });
    }
    const token = authHeader.split(' ')[1];
    const user = sessionStore.get(token);

    if (user) {
        req.user = user;
        next();
    } else {
        res.status(401).json({ error: 'Accès non autorisé : Token invalide ou expiré.' });
    }
};

// --- Security: SuperAdmin Role Middleware ---
const superAdminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'SuperAdmin') {
        next();
    } else {
        res.status(403).json({ error: 'Accès refusé. Cette action requiert les droits de SuperAdmin.' });
    }
};

// Helper function for consistent error handling
const handleRequest = (handler) => async (req, res) => {
    try {
        await handler(req, res);
    } catch (error) {
        console.error(`API Error on ${req.method} ${req.path}:`, error);
        res.status(500).json({ error: 'Erreur Interne du Serveur', details: error.message });
    }
};

// --- API ROUTES ---

// --- Existing Routes ---

/**
 * @openapi
 * tags:
 *   - name: Authentification
 *     description: Connexion et gestion de session
 *   - name: Application
 *     description: Actions globales sur l'application
 *   - name: Monitoring
 *     description: Surveillance de l'état du système
 *   - name: Utilisateurs
 *     description: Gestion des utilisateurs et de leurs droits
 *   - name: Groupes
 *     description: Gestion des groupes d'agents
 *   - name: Campagnes
 *     description: Gestion des campagnes d'appels sortants
 *   - name: Contacts
 *     description: Gestion des fiches contacts et des notes associées
 *   - name: Scripts
 *     description: Gestion des scripts d'agents
 *   - name: SVI
 *     description: Gestion des flux de Serveur Vocal Interactif
 *   - name: Qualifications
 *     description: Gestion des qualifications d'appel
 *   - name: Téléphonie
 *     description: Gestion des Trunks SIP et des numéros SDA/DID
 *   - name: Sites
 *     description: Gestion des sites physiques
 *   - name: Média
 *     description: Gestion de la bibliothèque audio
 *   - name: Planning
 *     description: Gestion des plannings agents
 *   - name: Base de Données
 *     description: Accès direct à la base de données (SuperAdmin)
 *   - name: Click-to-Call
 *     description: API pour l'intégration avec les PBX Yeastar
 */

app.post('/api/login', handleRequest(async (req, res) => {
    const { loginId, password } = req.body;
    if (!loginId || !password) {
        return res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
    }
    const user = await db.authenticateUser(loginId, password);
    if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        sessionStore.set(token, user);
        
        // [NOUVEAU] Enregistrement du site de l'agent dans Asterisk si en mode AMI
        if (PBX_CONNECTION_MODE === 'asterisk_ami' && user.role === 'Agent' && user.siteId) {
            try {
                await asteriskRouter.setAgentSite(user.extension, user.siteId);
                console.log(`[AMI] Site '${user.siteId}' enregistré pour l'extension ${user.extension}`);
            } catch (amiError) {
                console.error(`[AMI] Erreur lors de l'enregistrement du site pour l'extension ${user.extension}:`, amiError);
                // On ne bloque pas la connexion pour ça, mais on log l'erreur.
            }
        }

        res.json({ user, token });
    } else {
        res.status(401).json({ error: 'Identifiants invalides.' });
    }
}));
app.get('/api/me', authMiddleware, handleRequest(async (req, res) => res.json(req.user)));
app.get('/api/application-data', authMiddleware, handleRequest(async (req, res) => res.json(await db.getAllApplicationData())));
app.get('/api/system-stats', authMiddleware, handleRequest(async (req, res) => {
    try {
        const [cpuInfo, mem, fsData, currentLoad] = await Promise.all([
            si.cpu(),
            si.mem(),
            si.fsSize(),
            si.currentLoad(),
        ]);

        const rootFs = fsData.find(d => d.mount === '/');

        let recordingsInfo = { size: 0, files: 0, path: '/var/spool/asterisk/monitor/' };
        try {
            const files = await fs.readdir(recordingsInfo.path);
            let totalSize = 0;
            const fileStatsPromises = files.map(file => fs.stat(path.join(recordingsInfo.path, file)));
            const allStats = await Promise.all(fileStatsPromises);

            allStats.forEach(stat => {
                if (stat.isFile()) {
                    totalSize += stat.size;
                }
            });

            recordingsInfo.size = totalSize;
            recordingsInfo.files = files.length;
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.warn(`Could not read recording directory '${recordingsInfo.path}':`, err.code);
            }
        }
        
        res.json({
            cpu: {
                brand: cpuInfo.brand,
                manufacturer: cpuInfo.manufacturer,
                load: currentLoad.currentLoad.toFixed(1),
            },
            ram: {
                total: mem.total,
                used: mem.used,
            },
            disk: rootFs ? {
                total: rootFs.size,
                used: rootFs.used,
            } : null,
            recordings: recordingsInfo,
        });
    } catch (error) {
        console.error("Error fetching system stats:", error);
        res.status(500).json({ error: "Impossible de récupérer les statistiques système." });
    }
}));
app.get('/api/db-schema', authMiddleware, superAdminOnly, handleRequest(async (req, res) => res.json(await db.getDatabaseSchema())));
app.post('/api/db-query', authMiddleware, superAdminOnly, handleRequest(async (req, res) => {
    const { query, readOnly } = req.body;
    if (!query || typeof query !== 'string') return res.status(400).json({ error: "Requête invalide." });
    if (readOnly) {
        const forbiddenKeywords = ['UPDATE', 'DELETE', 'INSERT', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE'];
        if (forbiddenKeywords.some(keyword => query.toUpperCase().includes(keyword))) {
            return res.status(400).json({ error: "Les commandes de modification sont bloquées en mode lecture seule." });
        }
    }
    try {
        const result = await db.executeQuery(query);
        res.json({ columns: result.fields.map(f => f.name), rows: result.rows, rowCount: result.rowCount });
    } catch (dbError) {
        res.status(400).json({ error: dbError.message });
    }
}));
// --- CRUD routes ---
app.post('/api/users', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.createUser(req.body.user, req.body.groupIds))));
app.put('/api/users/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.updateUser(req.params.id, req.body.user, req.body.groupIds))));
app.delete('/api/users/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteUser(req.params.id); res.status(204).send(); }));
app.post('/api/groups', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveUserGroup(req.body))));
app.put('/api/groups/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveUserGroup(req.body, req.params.id))));
app.delete('/api/groups/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteUserGroup(req.params.id); res.status(204).send(); }));
app.post('/api/campaigns', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveCampaign(req.body))));
app.put('/api/campaigns/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveCampaign(req.body, req.params.id))));
app.delete('/api/campaigns/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteCampaign(req.params.id); res.status(204).send(); }));
app.post('/api/campaigns/:id/contacts', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.importContacts(req.params.id, req.body.contacts, req.body.deduplicationConfig))));
app.get('/api/contacts/:contactId/notes', authMiddleware, handleRequest(async (req, res) => res.json(await db.getNotesForContact(req.params.contactId))));
app.post('/api/contacts/:contactId/notes', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.createNote({ contactId: req.params.contactId, agentId: req.user.id, campaignId: req.body.campaignId, note: req.body.note }))));
app.put('/api/contacts/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.updateContact(req.params.id, req.body))));
app.delete('/api/contacts', authMiddleware, handleRequest(async (req, res) => { await db.deleteContacts(req.body.contactIds); res.status(204).send(); }));
app.post('/api/campaigns/:campaignId/contacts/single', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.createSingleContact(req.params.campaignId, req.body.contactData, req.body.phoneNumber))));
app.post('/api/scripts', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveScript(req.body))));
app.put('/api/scripts/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveScript(req.body, req.params.id))));
app.delete('/api/scripts/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteScript(req.params.id); res.status(204).send(); }));
app.post('/api/scripts/:id/duplicate', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.duplicateScript(req.params.id))));
app.post('/api/ivr-flows', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveIvrFlow(req.body))));
app.put('/api/ivr-flows/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveIvrFlow(req.body, req.params.id))));
app.delete('/api/ivr-flows/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteIvrFlow(req.params.id); res.status(204).send(); }));
app.post('/api/ivr-flows/:id/duplicate', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.duplicateIvrFlow(req.params.id))));
app.post('/api/qualifications', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveQualification(req.body))));
app.put('/api/qualifications/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveQualification(req.body, req.params.id))));
app.delete('/api/qualifications/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteQualification(req.params.id); res.status(204).send(); }));
app.post('/api/qualification-groups', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveQualificationGroup(req.body.group, req.body.assignedQualIds))));
app.put('/api/qualification-groups/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveQualificationGroup(req.body.group, req.body.assignedQualIds, req.params.id))));
app.delete('/api/qualification-groups/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteQualificationGroup(req.params.id); res.status(204).send(); }));
app.post('/api/trunks', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveTrunk(req.body))));
app.put('/api/trunks/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveTrunk(req.body, req.params.id))));
app.delete('/api/trunks/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteTrunk(req.params.id); res.status(204).send(); }));
app.post('/api/dids', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveDid(req.body))));
app.put('/api/dids/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveDid(req.body, req.params.id))));
app.delete('/api/dids/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteDid(req.params.id); res.status(204).send(); }));
app.post('/api/sites', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveSite(req.body))));
app.put('/api/sites/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveSite(req.body, req.params.id))));
app.delete('/api/sites/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteSite(req.params.id); res.status(204).send(); }));
app.post('/api/audio-files', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveAudioFile(req.body))));
app.put('/api/audio-files/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveAudioFile(req.body, req.params.id))));
app.delete('/api/audio-files/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteAudioFile(req.params.id); res.status(204).send(); }));
app.post('/api/planning-events', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.savePlanningEvent(req.body))));
app.put('/api/planning-events/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.savePlanningEvent(req.body, req.params.id))));
app.delete('/api/planning-events/:id', authMiddleware, handleRequest(async (req, res) => { await db.deletePlanningEvent(req.params.id); res.status(204).send(); }));

// --- New Routes for Yeastar Integration ---
app.use('/api/call', authMiddleware, require('./routes/call'));
app.use('/api/pbx', require('./routes/webhook')); // Webhook might not have auth


// --- Start the API server ---
server.listen(API_PORT, () => {
    console.log(`API Server listening on port ${API_PORT}`);
});