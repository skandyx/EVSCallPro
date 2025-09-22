require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;
const FastAGI = require('fastagi');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const si = require('systeminformation');
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
 *     summary: Récupère les informations de l'utilisateur authentifié via son token.
 *     tags: [Authentification]
 *     responses:
 *       200:
 *         description: Objet utilisateur.
 *       401:
 *         description: Token invalide ou expiré.
 */
app.get('/api/me', authMiddleware, handleRequest(async (req, res) => {
    res.json(req.user);
}));

/**
 * @openapi
 * /application-data:
 *   get:
 *     summary: Récupère toutes les données de configuration initiales pour l'application.
 *     tags: [Application]
 *     responses:
 *       200:
 *         description: Un objet contenant toutes les données de l'application (utilisateurs, campagnes, etc.).
 */
app.get('/api/application-data', authMiddleware, handleRequest(async (req, res) => {
    const data = await db.getAllApplicationData();
    res.json(data);
}));

/**
 * @openapi
 * /system-stats:
 *   get:
 *     summary: Récupère les statistiques système en temps réel (CPU, RAM, Disque, Enregistrements).
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Un objet contenant les métriques de santé du serveur.
 */
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
            if (err.code !== 'ENOENT') { // Log errors other than "directory not found"
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

// DB Query Endpoint (SuperAdmin Only)
/**
 * @openapi
 * /db-query:
 *   post:
 *     summary: Exécute une requête SQL sur la base de données. (SuperAdmin)
 *     tags: [Base de Données]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query: { type: string, description: "La requête SQL à exécuter." }
 *               readOnly: { type: boolean, description: "Si true, bloque les requêtes d'écriture." }
 *     responses:
 *       200:
 *         description: "Résultat de la requête, incluant les colonnes et les lignes."
 *       400:
 *         description: "Requête invalide ou commande d'écriture bloquée en mode lecture seule."
 *       403:
 *         description: "Accès refusé."
 */
app.post('/api/db-query', authMiddleware, superAdminOnly, handleRequest(async (req, res) => {
    const { query, readOnly } = req.body;
    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Requête invalide." });
    }

    if (readOnly) {
        const forbiddenKeywords = ['UPDATE', 'DELETE', 'INSERT', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE'];
        const upperQuery = query.toUpperCase();
        if (forbiddenKeywords.some(keyword => upperQuery.includes(keyword))) {
            return res.status(400).json({ error: "Les commandes de modification sont bloquées en mode lecture seule." });
        }
    }

    try {
        const result = await db.executeQuery(query);
        res.json({
            columns: result.fields.map(f => f.name),
            rows: result.rows,
            rowCount: result.rowCount
        });
    } catch (dbError) {
        // Erreur de la base de données (syntaxe, etc.)
        res.status(400).json({ error: dbError.message });
    }
}));


// Users
/**
 * @openapi
 * /users:
 *   get:
 *     summary: Récupère la liste de tous les utilisateurs.
 *     tags: [Utilisateurs]
 *     responses:
 *       200: { description: "Liste d'utilisateurs." }
 *   post:
 *     summary: Crée un nouvel utilisateur.
 *     tags: [Utilisateurs]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, properties: { user: { type: object }, groupIds: { type: array, items: { type: string } } } } } }
 *     responses:
 *       201: { description: "Utilisateur créé." }
 */
app.get('/api/users', authMiddleware, handleRequest(async (req, res) => res.json(await db.getUsers())));
app.post('/api/users', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.createUser(req.body.user, req.body.groupIds))));

/**
 * @openapi
 * /users/{id}:
 *   put:
 *     summary: Met à jour un utilisateur existant.
 *     tags: [Utilisateurs]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, properties: { user: { type: object }, groupIds: { type: array, items: { type: string } } } } } }
 *     responses:
 *       200: { description: "Utilisateur mis à jour." }
 *   delete:
 *     summary: Supprime un utilisateur.
 *     tags: [Utilisateurs]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       204: { description: "Utilisateur supprimé." }
 */
app.put('/api/users/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.updateUser(req.params.id, req.body.user, req.body.groupIds))));
app.delete('/api/users/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteUser(req.params.id); res.status(204).send(); }));

// Groups
/**
 * @openapi
 * /groups:
 *   post:
 *     summary: Crée un nouveau groupe.
 *     tags: [Groupes]
 *     responses:
 *       201: { description: "Groupe créé." }
 * /groups/{id}:
 *   put:
 *     summary: Met à jour un groupe.
 *     tags: [Groupes]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       200: { description: "Groupe mis à jour." }
 *   delete:
 *     summary: Supprime un groupe.
 *     tags: [Groupes]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       204: { description: "Groupe supprimé." }
 */
app.post('/api/groups', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveUserGroup(req.body))));
app.put('/api/groups/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveUserGroup(req.body, req.params.id))));
app.delete('/api/groups/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteUserGroup(req.params.id); res.status(204).send(); }));

// Campaigns
/**
 * @openapi
 * /campaigns:
 *   post:
 *     summary: Crée une nouvelle campagne.
 *     tags: [Campagnes]
 *     responses:
 *       201: { description: "Campagne créée." }
 * /campaigns/{id}:
 *   put:
 *     summary: Met à jour une campagne.
 *     tags: [Campagnes]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       200: { description: "Campagne mise à jour." }
 *   delete:
 *     summary: Supprime une campagne.
 *     tags: [Campagnes]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       204: { description: "Campagne supprimée." }
 * /campaigns/{id}/contacts:
 *   post:
 *     summary: Importe des contacts en masse dans une campagne.
 *     tags: [Campagnes]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       201: { description: "Contacts importés." }
 */
app.post('/api/campaigns', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveCampaign(req.body))));
app.put('/api/campaigns/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveCampaign(req.body, req.params.id))));
app.delete('/api/campaigns/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteCampaign(req.params.id); res.status(204).send(); }));
app.post('/api/campaigns/:id/contacts', authMiddleware, handleRequest(async (req, res) => {
    const { contacts, deduplicationConfig } = req.body;
    const result = await db.importContacts(req.params.id, contacts, deduplicationConfig);
    res.status(201).json(result);
}));

// Contact Notes & Single Contact creation
/**
 * @openapi
 * /contacts/{contactId}/notes:
 *   get:
 *     summary: Récupère l'historique des notes pour un contact.
 *     tags: [Contacts]
 *     parameters: [ { in: path, name: contactId, required: true, schema: { type: string } } ]
 *     responses:
 *       200: { description: "Liste des notes." }
 *   post:
 *     summary: Ajoute une nouvelle note à un contact.
 *     tags: [Contacts]
 *     parameters: [ { in: path, name: contactId, required: true, schema: { type: string } } ]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, properties: { campaignId: { type: string }, note: { type: string } } } } }
 *     responses:
 *       201: { description: "Note créée." }
 * /contacts/{id}:
 *   put:
 *     summary: Met à jour une fiche contact.
 *     tags: [Contacts]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       200: { description: "Contact mis à jour." }
 * /contacts:
 *   delete:
 *     summary: Supprime un ou plusieurs contacts en masse.
 *     tags: [Contacts]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, properties: { contactIds: { type: array, items: { type: string } } } } } }
 *     responses:
 *       204: { description: "Contact(s) supprimé(s)." }
 */
app.get('/api/contacts/:contactId/notes', authMiddleware, handleRequest(async (req, res) => {
    res.json(await db.getNotesForContact(req.params.contactId));
}));
app.post('/api/contacts/:contactId/notes', authMiddleware, handleRequest(async (req, res) => {
    const { contactId } = req.params;
    const { campaignId, note } = req.body;
    const agentId = req.user.id;
    const newNote = await db.createNote({ contactId, agentId, campaignId, note });
    res.status(201).json(newNote);
}));
app.put('/api/contacts/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.updateContact(req.params.id, req.body))));
app.delete('/api/contacts', authMiddleware, handleRequest(async (req, res) => { await db.deleteContacts(req.body.contactIds); res.status(204).send(); }));


/**
 * @openapi
 * /campaigns/{campaignId}/contacts/single:
 *   post:
 *     summary: Crée une seule fiche contact dans une campagne (depuis l'interface agent).
 *     tags: [Contacts]
 *     parameters: [ { in: path, name: campaignId, required: true, schema: { type: string } } ]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, properties: { contactData: { type: object, description: "Données du script" }, phoneNumber: { type: string } } } } }
 *     responses:
 *       201: { description: "Contact créé." }
 *       400: { description: "Numéro de téléphone manquant ou invalide." }
 */
app.post('/api/campaigns/:campaignId/contacts/single', authMiddleware, handleRequest(async (req, res) => {
    const { campaignId } = req.params;
    const { contactData, phoneNumber } = req.body;
    if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim().length < 10) {
        return res.status(400).json({ error: "Un numéro de téléphone valide est requis." });
    }
    const newContact = await db.createSingleContact(campaignId, contactData, phoneNumber);
    res.status(201).json(newContact);
}));


// Scripts
/**
 * @openapi
 * /scripts:
 *   post:
 *     summary: Crée un nouveau script.
 *     tags: [Scripts]
 *     responses:
 *       201: { description: "Script créé." }
 * /scripts/{id}:
 *   put:
 *     summary: Met à jour un script.
 *     tags: [Scripts]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       200: { description: "Script mis à jour." }
 *   delete:
 *     summary: Supprime un script.
 *     tags: [Scripts]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       204: { description: "Script supprimé." }
 * /scripts/{id}/duplicate:
 *   post:
 *     summary: Duplique un script.
 *     tags: [Scripts]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       201: { description: "Script dupliqué." }
 */
app.post('/api/scripts', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveScript(req.body))));
app.put('/api/scripts/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveScript(req.body, req.params.id))));
app.delete('/api/scripts/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteScript(req.params.id); res.status(204).send(); }));
app.post('/api/scripts/:id/duplicate', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.duplicateScript(req.params.id))));

// IVR Flows
/**
 * @openapi
 * /ivr-flows:
 *   post:
 *     summary: Crée un nouveau flux SVI.
 *     tags: [SVI]
 *     responses:
 *       201: { description: "Flux SVI créé." }
 * /ivr-flows/{id}:
 *   put:
 *     summary: Met à jour un flux SVI.
 *     tags: [SVI]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       200: { description: "Flux SVI mis à jour." }
 *   delete:
 *     summary: Supprime un flux SVI.
 *     tags: [SVI]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       204: { description: "Flux SVI supprimé." }
 * /ivr-flows/{id}/duplicate:
 *   post:
 *     summary: Duplique un flux SVI.
 *     tags: [SVI]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       201: { description: "Flux SVI dupliqué." }
 */
app.post('/api/ivr-flows', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveIvrFlow(req.body))));
app.put('/api/ivr-flows/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveIvrFlow(req.body, req.params.id))));
app.delete('/api/ivr-flows/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteIvrFlow(req.params.id); res.status(204).send(); }));
app.post('/api/ivr-flows/:id/duplicate', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.duplicateIvrFlow(req.params.id))));

// Qualifications
/**
 * @openapi
 * /qualifications:
 *   post:
 *     summary: Crée une nouvelle qualification.
 *     tags: [Qualifications]
 *     responses:
 *       201: { description: "Qualification créée." }
 * /qualifications/{id}:
 *   put:
 *     summary: Met à jour une qualification.
 *     tags: [Qualifications]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       200: { description: "Qualification mise à jour." }
 *   delete:
 *     summary: Supprime une qualification.
 *     tags: [Qualifications]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       204: { description: "Qualification supprimée." }
 */
app.post('/api/qualifications', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveQualification(req.body))));
app.put('/api/qualifications/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveQualification(req.body, req.params.id))));
app.delete('/api/qualifications/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteQualification(req.params.id); res.status(204).send(); }));

// Qualification Groups
/**
 * @openapi
 * /qualification-groups:
 *   post:
 *     summary: Crée un nouveau groupe de qualifications.
 *     tags: [Qualifications]
 *     responses:
 *       201: { description: "Groupe créé." }
 * /qualification-groups/{id}:
 *   put:
 *     summary: Met à jour un groupe de qualifications.
 *     tags: [Qualifications]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       200: { description: "Groupe mis à jour." }
 *   delete:
 *     summary: Supprime un groupe de qualifications.
 *     tags: [Qualifications]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       204: { description: "Groupe supprimé." }
 */
app.post('/api/qualification-groups', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveQualificationGroup(req.body.group, req.body.assignedQualIds))));
app.put('/api/qualification-groups/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveQualificationGroup(req.body.group, req.body.assignedQualIds, req.params.id))));
app.delete('/api/qualification-groups/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteQualificationGroup(req.params.id); res.status(204).send(); }));

// Trunks
/**
 * @openapi
 * /trunks:
 *   post:
 *     summary: Crée un nouveau Trunk SIP.
 *     tags: [Téléphonie]
 *     responses:
 *       201: { description: "Trunk créé." }
 * /trunks/{id}:
 *   put:
 *     summary: Met à jour un Trunk SIP.
 *     tags: [Téléphonie]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       200: { description: "Trunk mis à jour." }
 *   delete:
 *     summary: Supprime un Trunk SIP.
 *     tags: [Téléphonie]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       204: { description: "Trunk supprimé." }
 */
app.post('/api/trunks', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveTrunk(req.body))));
app.put('/api/trunks/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveTrunk(req.body, req.params.id))));
app.delete('/api/trunks/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteTrunk(req.params.id); res.status(204).send(); }));

// DIDs
/**
 * @openapi
 * /dids:
 *   post:
 *     summary: Crée un nouveau numéro SDA/DID.
 *     tags: [Téléphonie]
 *     responses:
 *       201: { description: "Numéro créé." }
 * /dids/{id}:
 *   put:
 *     summary: Met à jour un numéro SDA/DID.
 *     tags: [Téléphonie]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       200: { description: "Numéro mis à jour." }
 *   delete:
 *     summary: Supprime un numéro SDA/DID.
 *     tags: [Téléphonie]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       204: { description: "Numéro supprimé." }
 */
app.post('/api/dids', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveDid(req.body))));
app.put('/api/dids/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveDid(req.body, req.params.id))));
app.delete('/api/dids/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteDid(req.params.id); res.status(204).send(); }));

// Sites
/**
 * @openapi
 * /sites:
 *   post:
 *     summary: Crée un nouveau site.
 *     tags: [Sites]
 *     responses:
 *       201: { description: "Site créé." }
 * /sites/{id}:
 *   put:
 *     summary: Met à jour un site.
 *     tags: [Sites]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       200: { description: "Site mis à jour." }
 *   delete:
 *     summary: Supprime un site.
 *     tags: [Sites]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       204: { description: "Site supprimé." }
 */
app.post('/api/sites', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveSite(req.body))));
app.put('/api/sites/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveSite(req.body, req.params.id))));
app.delete('/api/sites/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteSite(req.params.id); res.status(204).send(); }));

// Audio Files
/**
 * @openapi
 * /audio-files:
 *   post:
 *     summary: Ajoute un nouveau fichier audio.
 *     tags: [Média]
 *     responses:
 *       201: { description: "Fichier ajouté." }
 * /audio-files/{id}:
 *   put:
 *     summary: Met à jour un fichier audio.
 *     tags: [Média]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       200: { description: "Fichier mis à jour." }
 *   delete:
 *     summary: Supprime un fichier audio.
 *     tags: [Média]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       204: { description: "Fichier supprimé." }
 */
app.post('/api/audio-files', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.saveAudioFile(req.body))));
app.put('/api/audio-files/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.saveAudioFile(req.body, req.params.id))));
app.delete('/api/audio-files/:id', authMiddleware, handleRequest(async (req, res) => { await db.deleteAudioFile(req.params.id); res.status(204).send(); }));

// Planning
/**
 * @openapi
 * /planning-events:
 *   post:
 *     summary: Crée un nouvel événement de planning.
 *     tags: [Planning]
 *     responses:
 *       201: { description: "Événement créé." }
 * /planning-events/{id}:
 *   put:
 *     summary: Met à jour un événement de planning.
 *     tags: [Planning]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       200: { description: "Événement mis à jour." }
 *   delete:
 *     summary: Supprime un événement de planning.
 *     tags: [Planning]
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses:
 *       204: { description: "Événement supprimé." }
 */
app.post('/api/planning-events', authMiddleware, handleRequest(async (req, res) => res.status(201).json(await db.savePlanningEvent(req.body))));
app.put('/api/planning-events/:id', authMiddleware, handleRequest(async (req, res) => res.json(await db.savePlanningEvent(req.body, req.params.id))));
app.delete('/api/planning-events/:id', authMiddleware, handleRequest(async (req, res) => { await db.deletePlanningEvent(req.params.id); res.status(204).send(); }));

// --- Start the API server ---
app.listen(API_PORT, () => {
    console.log(`API Server listening on port ${API_PORT}`);
});