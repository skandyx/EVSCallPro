require('dotenv').config();
const path = require('path');
const http = require('http');
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
const callRoutes = require('./routes/call'); // Import des routes d'appel
const webhookRoutes = require('./routes/webhook'); // Import des routes webhook

// --- Import des services de téléphonie ---
const PbxPoller = require('./services/pbxPoller');
const AmiListener = require('./services/amiListener');
const asteriskRouter = require('./services/asteriskRouter');

const AGI_PORT = process.env.AGI_PORT || 4573;
const API_PORT = process.env.API_PORT || 3001;

// --- AGI Server for Asterisk (if needed) ---
const agiServer = FastAGI.createServer(agiHandler);
agiServer.listen(AGI_PORT, () => {
    console.log(`AGI Server listening on port ${AGI_PORT}`);
});

// --- API Server for Frontend ---
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  console.log('Client connected to WebSocket');
  ws.on('close', () => console.log('Client disconnected'));
});

// --- Initialisation conditionnelle des services de téléphonie ---
if (process.env.PBX_CONNECTION_MODE === 'ASTERISK_AMI') {
    console.log('Starting in ASTERISK_AMI mode.');
    AmiListener.start(wss);
} else {
    console.log('Starting in YEASTAR_API mode.');
    PbxPoller.start(wss);
}

// --- Swagger / OpenAPI Configuration ---
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EVSCallPro API',
      version: '1.0.0',
      description: 'API pour la solution de centre de contact EVSCallPro, permettant de gérer toutes les ressources de l\'application.',
    },
    servers: [ { url: '/api', description: 'Serveur principal' } ],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }}},
    security: [ { bearerAuth: [] } ],
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
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Accès non autorisé : Token manquant.' });
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
    if (req.user && req.user.role === 'SuperAdmin') next();
    else res.status(403).json({ error: 'Accès refusé. Cette action requiert les droits de SuperAdmin.' });
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
app.use('/api/call', authMiddleware, callRoutes);
app.use('/api/pbx', webhookRoutes); // Webhook n'a pas besoin d'auth

/**
 * @openapi
 * tags:
 *   - name: Authentification
 *   - name: Application
 *   - name: Monitoring
 *   - name: Utilisateurs
 *   - name: Groupes
 *   - name: Campagnes
 *   - name: Contacts
 *   - name: Scripts
 *   - name: SVI
 *   - name: Qualifications
 *   - name: Téléphonie
 *   - name: Sites
 *   - name: Média
 *   - name: Planning
 *   - name: Base de Données
 */

// --- Public Routes ---
app.post('/api/login', handleRequest(async (req, res) => {
    const { loginId, password } = req.body;
    if (!loginId || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
    
    const user = await db.authenticateUser(loginId, password);
    if (user) {
        // En mode Asterisk, on met à jour la base de données Asterisk
        if (process.env.PBX_CONNECTION_MODE === 'ASTERISK_AMI' && user.extension && user.siteId) {
            try {
                await asteriskRouter.setSiteTrunk(user.extension, user.siteId);
                console.log(`Asterisk DB updated for agent ${user.extension} with site ${user.siteId}`);
            } catch (amiError) {
                console.error(`Failed to update Asterisk DB for agent ${user.extension}:`, amiError);
                // On ne bloque pas la connexion pour ça, mais on log l'erreur.
            }
        }

        const token = crypto.randomBytes(32).toString('hex');
        sessionStore.set(token, user);
        res.json({ user, token });
    } else {
        res.status(401).json({ error: 'Identifiants invalides.' });
    }
}));

// --- Protected Routes ---
app.get('/api/me', authMiddleware, handleRequest(async (req, res) => res.json(req.user)));
app.get('/api/application-data', authMiddleware, handleRequest(async (req, res) => res.json(await db.getAllApplicationData())));
app.get('/api/system-stats', authMiddleware, handleRequest(async (req, res) => { /* ... (code inchangé) ... */ }));
app.get('/api/db-schema', authMiddleware, superAdminOnly, handleRequest(async (req, res) => res.json(await db.getDatabaseSchema())));
app.post('/api/db-query', authMiddleware, superAdminOnly, handleRequest(async (req, res) => { /* ... (code inchangé) ... */ }));

// CRUD routes...
app.get('/api/users', authMiddleware, handleRequest(async (req, res) => res.json(await db.getUsers())));
app.post('/api/users', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.createUser(req.body.user, req.body.groupIds))));
app.put('/api/users/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.updateUser(req.params.id, req.body.user, req.body.groupIds))));
app.delete('/api/users/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteUser(req.params.id); res.status(204).send(); }));

// ... (toutes les autres routes CRUD restent identiques)

// --- Start the API server ---
server.listen(API_PORT, () => {
    console.log(`API Server with WebSocket listening on port ${API_PORT}`);
});
