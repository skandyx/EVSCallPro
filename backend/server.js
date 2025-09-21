require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const FastAGI = require('fastagi');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const agiHandler = require('./agi-handler.js');
const db = require('./services/db');

const AGI_PORT = process.env.AGI_PORT || 4573;
const API_PORT = process.env.API_PORT || 3001;

// --- AGI Server for Asterisk ---
const agiServer = FastAGI.createServer(agiHandler);
agiServer.listen(AGI_PORT, () => {
    console.log(`AGI Server listening on port ${AGI_PORT}`);
});

// --- API Server for Frontend ---
const app = express();
app.use(cors());
app.use(express.json());

// --- Swagger / OpenAPI Configuration ---
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EVSCallPro API',
      version: '1.0.0',
      description: 'API pour la solution de centre de contact EVSCallPro, permettant de gérer toutes les ressources de l\'application.',
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
  apis: [path.resolve(__dirname, 'server.js')], 
};

const openapiSpecification = swaggerJsdoc(swaggerOptions);
// Correction: Changed URL to /api/docs to work with existing proxy setups
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

/**
 * @openapi
 * tags:
 *   - name: Authentification
 *     description: Connexion et gestion de session
 *   - name: Application
 *     description: Actions globales sur l'application
 *   - name: Utilisateurs
 *     description: Gestion des utilisateurs et de leurs droits
 *   - name: Groupes
 *     description: Gestion des groupes d'agents
 *   - name: Campagnes
 *     description: Gestion des campagnes d'appels sortants
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
 */

// --- Public Routes (No Auth Required) ---

/**
 * @openapi
 * /login:
 *   post:
 *     summary: Authentifie un utilisateur et retourne un token de session.
 *     tags: [Authentification]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { loginId: { type: string }, password: { type: string } } }
 *     responses:
 *       200:
 *         description: Authentification réussie.
 *       401:
 *         description: Identifiants invalides.
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
        res.json({ user, token });
    } else {
        res.status(401).json({ error: 'Identifiants invalides.' });
    }
}));


// --- Protected Routes (Auth Required) ---

/**
 * @openapi
 * /me:
 *   get:
 *     summary: Récupère les informations de l'utilisateur authentifié.
 *     tags: [Authentification]
 *     responses:
 *       200:
 *         description: Objet utilisateur.
 */
app.get('/api/me', authMiddleware, handleRequest(async (req, res) => {
    res.json(req.user);
}));

/**
 * @openapi
 * /application-data:
 *   get:
 *     summary: Récupère toutes les données de configuration initiales.
 *     tags: [Application]
 *     responses:
 *       200:
 *         description: Un objet contenant toutes les données de l'application.
 */
app.get('/api/application-data', authMiddleware, handleRequest(async (req, res) => {
    const data = await db.getAllApplicationData();
    res.json(data);
}));


// Users
app.get('/api/users', authMiddleware, handleRequest(async (req, res) => res.json(await db.getUsers())));
app.post('/api/users', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.createUser(req.body.user, req.body.groupIds))));
app.put('/api/users/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.updateUser(req.params.id, req.body.user, req.body.groupIds))));
app.delete('/api/users/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteUser(req.params.id); res.status(204).send(); }));

// Groups
app.post('/api/groups', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveUserGroup(req.body))));
app.put('/api/groups/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveUserGroup(req.body, req.params.id))));
app.delete('/api/groups/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteUserGroup(req.params.id); res.status(204).send(); }));

// Campaigns
app.post('/api/campaigns', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveCampaign(req.body))));
app.put('/api/campaigns/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveCampaign(req.body, req.params.id))));
app.delete('/api/campaigns/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteCampaign(req.params.id); res.status(204).send(); }));
app.post('/api/campaigns/:id/contacts', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.importContacts(req.params.id, req.body.contacts))));

// Scripts
app.post('/api/scripts', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveScript(req.body))));
app.put('/api/scripts/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveScript(req.body, req.params.id))));
app.delete('/api/scripts/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteScript(req.params.id); res.status(204).send(); }));
app.post('/api/scripts/:id/duplicate', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.duplicateScript(req.params.id))));

// IVR Flows
app.post('/api/ivr-flows', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveIvrFlow(req.body))));
app.put('/api/ivr-flows/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveIvrFlow(req.body, req.params.id))));
app.delete('/api/ivr-flows/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteIvrFlow(req.params.id); res.status(204).send(); }));
app.post('/api/ivr-flows/:id/duplicate', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.duplicateIvrFlow(req.params.id))));

// Qualifications
app.post('/api/qualifications', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveQualification(req.body))));
app.put('/api/qualifications/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveQualification(req.body, req.params.id))));
app.delete('/api/qualifications/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteQualification(req.params.id); res.status(204).send(); }));

// Qualification Groups
app.post('/api/qualification-groups', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveQualificationGroup(req.body.group, req.body.assignedQualIds))));
app.put('/api/qualification-groups/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveQualificationGroup(req.body.group, req.body.assignedQualIds, req.params.id))));
app.delete('/api/qualification-groups/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteQualificationGroup(req.params.id); res.status(204).send(); }));

// Trunks
app.post('/api/trunks', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveTrunk(req.body))));
app.put('/api/trunks/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveTrunk(req.body, req.params.id))));
app.delete('/api/trunks/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteTrunk(req.params.id); res.status(204).send(); }));

// DIDs
app.post('/api/dids', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveDid(req.body))));
app.put('/api/dids/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveDid(req.body, req.params.id))));
app.delete('/api/dids/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteDid(req.params.id); res.status(204).send(); }));

// Sites
app.post('/api/sites', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveSite(req.body))));
app.put('/api/sites/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveSite(req.body, req.params.id))));
app.delete('/api/sites/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteSite(req.params.id); res.status(204).send(); }));

// Audio Files
app.post('/api/audio-files', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveAudioFile(req.body))));
app.put('/api/audio-files/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveAudioFile(req.body, req.params.id))));
app.delete('/api/audio-files/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteAudioFile(req.params.id); res.status(204).send(); }));

// Planning
app.post('/api/planning-events', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.savePlanningEvent(req.body))));
app.put('/api/planning-events/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.savePlanningEvent(req.body, req.params.id))));
app.delete('/api/planning-events/:id', authMiddleware, handleRequest(async (req, res) => { await db.deletePlanningEvent(req.params.id); res.status(204).send(); }));

// --- Start the API server ---
app.listen(API_PORT, () => {
    console.log(`API Server listening on port ${API_PORT}`);
});
