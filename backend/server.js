require('dotenv').config();
const express = require('express');
const cors = require('cors');
const agi = require('node-fast-agi');
const agiHandler = require('./agi-handler.js');
const db = require('./services/db.js');

// =============================================================================
// == EXPRESS API SERVER (for Frontend communication)
// =============================================================================
const app = express();
const apiPort = process.env.API_PORT || 3001;

// Middlewares
app.use(cors()); // Use the cors middleware for better cross-origin handling
app.use(express.json()); // To parse JSON bodies

// --- Helper for consistent error handling ---
const handleRequest = (handler) => async (req, res) => {
    try {
        await handler(req, res);
    } catch (err) {
        console.error(`API Error on ${req.method} ${req.path}:`, err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// --- API ROUTES ---

// == USERS ==
app.get('/api/users', handleRequest(async (req, res) => {
    const users = await db.getUsers();
    res.json(users);
}));
app.post('/api/users', handleRequest(async (req, res) => {
    const { user, groupIds } = req.body;
    const newUser = await db.createUser(user, groupIds);
    res.status(201).json(newUser);
}));
app.put('/api/users/:id', handleRequest(async (req, res) => {
    const { user, groupIds } = req.body;
    const updatedUser = await db.updateUser(req.params.id, user, groupIds);
    res.json(updatedUser);
}));
app.delete('/api/users/:id', handleRequest(async (req, res) => {
    await db.deleteUser(req.params.id);
    res.status(204).send();
}));

// == GROUPS ==
app.get('/api/groups', handleRequest(async (req, res) => {
    const groups = await db.getUserGroups();
    res.json(groups);
}));
app.post('/api/groups', handleRequest(async (req, res) => {
    const newGroup = await db.createUserGroup(req.body);
    res.status(201).json(newGroup);
}));
app.put('/api/groups/:id', handleRequest(async (req, res) => {
    const updatedGroup = await db.updateUserGroup(req.params.id, req.body);
    res.json(updatedGroup);
}));
app.delete('/api/groups/:id', handleRequest(async (req, res) => {
    await db.deleteUserGroup(req.params.id);
    res.status(204).send();
}));

// == SITES ==
app.get('/api/sites', handleRequest(async (req, res) => {
    const sites = await db.getSites();
    res.json(sites);
}));
app.post('/api/sites', handleRequest(async (req, res) => {
    const newSite = await db.createSite(req.body);
    res.status(201).json(newSite);
}));
app.put('/api/sites/:id', handleRequest(async (req, res) => {
    const updatedSite = await db.updateSite(req.params.id, req.body);
    res.json(updatedSite);
}));
app.delete('/api/sites/:id', handleRequest(async (req, res) => {
    await db.deleteSite(req.params.id);
    res.status(204).send();
}));

// == TRUNKS ==
app.get('/api/trunks', handleRequest(async (req, res) => {
    const trunks = await db.getTrunks();
    res.json(trunks);
}));
app.post('/api/trunks', handleRequest(async (req, res) => {
    const newTrunk = await db.createTrunk(req.body);
    res.status(201).json(newTrunk);
}));
app.put('/api/trunks/:id', handleRequest(async (req, res) => {
    const updatedTrunk = await db.updateTrunk(req.params.id, req.body);
    res.json(updatedTrunk);
}));
app.delete('/api/trunks/:id', handleRequest(async (req, res) => {
    await db.deleteTrunk(req.params.id);
    res.status(204).send();
}));

// == DIDs (SDA) ==
app.get('/api/dids', handleRequest(async (req, res) => {
    const dids = await db.getDids();
    res.json(dids);
}));
app.post('/api/dids', handleRequest(async (req, res) => {
    const newDid = await db.createDid(req.body);
    res.status(201).json(newDid);
}));
app.put('/api/dids/:id', handleRequest(async (req, res) => {
    const updatedDid = await db.updateDid(req.params.id, req.body);
    res.json(updatedDid);
}));
app.delete('/api/dids/:id', handleRequest(async (req, res) => {
    await db.deleteDid(req.params.id);
    res.status(204).send();
}));

// == QUALIFICATIONS & GROUPS ==
app.get('/api/qualifications', handleRequest(async (req, res) => {
    const qualifications = await db.getQualifications();
    res.json(qualifications);
}));
app.post('/api/qualifications', handleRequest(async (req, res) => {
    const newQual = await db.createQualification(req.body);
    res.status(201).json(newQual);
}));
app.put('/api/qualifications/:id', handleRequest(async (req, res) => {
    const updatedQual = await db.updateQualification(req.params.id, req.body);
    res.json(updatedQual);
}));
app.delete('/api/qualifications/:id', handleRequest(async (req, res) => {
    await db.deleteQualification(req.params.id);
    res.status(204).send();
}));
app.get('/api/qualification-groups', handleRequest(async (req, res) => {
    const groups = await db.getQualificationGroups();
    res.json(groups);
}));
app.post('/api/qualification-groups', handleRequest(async (req, res) => {
    const { group, assignedQualIds } = req.body;
    const newGroup = await db.createQualificationGroup(group, assignedQualIds);
    res.status(201).json(newGroup);
}));
app.put('/api/qualification-groups/:id', handleRequest(async (req, res) => {
    const { group, assignedQualIds } = req.body;
    const updatedGroup = await db.updateQualificationGroup(req.params.id, group, assignedQualIds);
    res.json(updatedGroup);
}));
app.delete('/api/qualification-groups/:id', handleRequest(async (req, res) => {
    await db.deleteQualificationGroup(req.params.id);
    res.status(204).send();
}));

// == SCRIPTS ==
app.get('/api/scripts', handleRequest(async (req, res) => {
    const scripts = await db.getScripts();
    res.json(scripts);
}));
app.post('/api/scripts', handleRequest(async (req, res) => {
    const newScript = await db.createScript(req.body);
    res.status(201).json(newScript);
}));
app.put('/api/scripts/:id', handleRequest(async (req, res) => {
    const updatedScript = await db.updateScript(req.params.id, req.body);
    res.json(updatedScript);
}));
app.delete('/api/scripts/:id', handleRequest(async (req, res) => {
    await db.deleteScript(req.params.id);
    res.status(204).send();
}));

// == IVR FLOWS ==
app.get('/api/ivr-flows', handleRequest(async (req, res) => {
    const flows = await db.getIvrFlows();
    res.json(flows);
}));
app.post('/api/ivr-flows', handleRequest(async (req, res) => {
    const newFlow = await db.createIvrFlow(req.body);
    res.status(201).json(newFlow);
}));
app.put('/api/ivr-flows/:id', handleRequest(async (req, res) => {
    const updatedFlow = await db.updateIvrFlow(req.params.id, req.body);
    res.json(updatedFlow);
}));
app.delete('/api/ivr-flows/:id', handleRequest(async (req, res) => {
    await db.deleteIvrFlow(req.params.id);
    res.status(204).send();
}));

// == CAMPAIGNS ==
app.get('/api/campaigns', handleRequest(async (req, res) => {
    const campaigns = await db.getCampaigns();
    res.json(campaigns);
}));
app.post('/api/campaigns', handleRequest(async (req, res) => {
    const newCampaign = await db.createCampaign(req.body);
    res.status(201).json(newCampaign);
}));
app.put('/api/campaigns/:id', handleRequest(async (req, res) => {
    const updatedCampaign = await db.updateCampaign(req.params.id, req.body);
    res.json(updatedCampaign);
}));
app.delete('/api/campaigns/:id', handleRequest(async (req, res) => {
    await db.deleteCampaign(req.params.id);
    res.status(204).send();
}));
app.post('/api/campaigns/:id/contacts', handleRequest(async (req, res) => {
    const { contacts } = req.body;
    await db.importContacts(req.params.id, contacts);
    res.status(201).json({ message: 'Contacts imported successfully' });
}));


app.listen(apiPort, () => {
    console.log(`[API] Server listening on http://localhost:${apiPort}`);
});


// =============================================================================
// == AGI SERVER (for Asterisk communication)
// =============================================================================
const agiPort = process.env.AGI_PORT || 4573;

// Correct way to initialize the server with node-fast-agi
const agiServer = agi.createServer(agiHandler);

agiServer.listen(agiPort, () => {
    console.log(`[AGI] Server listening on port ${agiPort}`);
});

agiServer.on('error', (err) => {
    console.error(`[AGI] Server error:`, err);
});