require('dotenv').config();
const FastAGI = require('node-fast-agi');
const express = require('express');
const cors = require('cors');
const agiHandler = require('./agi-handler.js');
const db = require('./services/db.js');

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

// Helper function for consistent error handling
const handleRequest = (handler) => async (req, res) => {
    try {
        await handler(req, res);
    } catch (error) {
        console.error(`API Error on ${req.method} ${req.path}:`, error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};

// --- API ROUTES ---

// Master data loader
app.get('/api/application-data', handleRequest(async (req, res) => {
    const data = await db.getAllApplicationData();
    res.json(data);
}));

// Users
app.get('/api/users', handleRequest(async (req, res) => res.json(await db.getUsers())));
app.post('/api/users', handleRequest(async (req, res) => res.status(201).json(await db.createUser(req.body.user, req.body.groupIds))));
app.put('/api/users/:id', handleRequest(async (req, res) => res.json(await db.updateUser(req.params.id, req.body.user, req.body.groupIds))));
app.delete('/api/users/:id', handleRequest(async (req, res) => {
    await db.deleteUser(req.params.id);
    res.status(204).send();
}));

// Groups
app.get('/api/groups', handleRequest(async (req, res) => res.json(await db.getUserGroups())));
app.post('/api/groups', handleRequest(async (req, res) => res.status(201).json(await db.saveUserGroup(req.body))));
app.put('/api/groups/:id', handleRequest(async (req, res) => res.json(await db.saveUserGroup(req.body, req.params.id))));
app.delete('/api/groups/:id', handleRequest(async (req, res) => {
    await db.deleteUserGroup(req.params.id);
    res.status(204).send();
}));

// Campaigns
app.get('/api/campaigns', handleRequest(async (req, res) => res.json(await db.getCampaigns())));
app.post('/api/campaigns', handleRequest(async (req, res) => res.status(201).json(await db.saveCampaign(req.body))));
app.put('/api/campaigns/:id', handleRequest(async (req, res) => res.json(await db.saveCampaign(req.body, req.params.id))));
app.delete('/api/campaigns/:id', handleRequest(async (req, res) => {
    await db.deleteCampaign(req.params.id);
    res.status(204).send();
}));
app.post('/api/campaigns/:id/contacts', handleRequest(async (req, res) => res.status(201).json(await db.importContacts(req.params.id, req.body.contacts))));

// Scripts
app.get('/api/scripts', handleRequest(async (req, res) => res.json(await db.getScripts())));
app.post('/api/scripts', handleRequest(async (req, res) => res.status(201).json(await db.saveScript(req.body))));
app.put('/api/scripts/:id', handleRequest(async (req, res) => res.json(await db.saveScript(req.body, req.params.id))));
app.delete('/api/scripts/:id', handleRequest(async (req, res) => {
    await db.deleteScript(req.params.id);
    res.status(204).send();
}));
app.post('/api/scripts/:id/duplicate', handleRequest(async (req, res) => res.status(201).json(await db.duplicateScript(req.params.id))));


// IVR Flows
app.get('/api/ivr-flows', handleRequest(async (req, res) => res.json(await db.getIvrFlows())));
app.post('/api/ivr-flows', handleRequest(async (req, res) => res.status(201).json(await db.saveIvrFlow(req.body))));
app.put('/api/ivr-flows/:id', handleRequest(async (req, res) => res.json(await db.saveIvrFlow(req.body, req.params.id))));
app.delete('/api/ivr-flows/:id', handleRequest(async (req, res) => {
    await db.deleteIvrFlow(req.params.id);
    res.status(204).send();
}));
app.post('/api/ivr-flows/:id/duplicate', handleRequest(async (req, res) => res.status(201).json(await db.duplicateIvrFlow(req.params.id))));


// Qualifications & Groups
app.get('/api/qualifications', handleRequest(async (req, res) => res.json(await db.getQualifications())));
app.post('/api/qualifications', handleRequest(async (req, res) => res.status(201).json(await db.saveQualification(req.body))));
app.put('/api/qualifications/:id', handleRequest(async (req, res) => res.json(await db.saveQualification(req.body, req.params.id))));
app.delete('/api/qualifications/:id', handleRequest(async (req, res) => {
    await db.deleteQualification(req.params.id);
    res.status(204).send();
}));

app.get('/api/qualification-groups', handleRequest(async (req, res) => res.json(await db.getQualificationGroups())));
app.post('/api/qualification-groups', handleRequest(async (req, res) => res.status(201).json(await db.saveQualificationGroup(req.body.group, req.body.assignedQualIds))));
app.put('/api/qualification-groups/:id', handleRequest(async (req, res) => res.json(await db.saveQualificationGroup(req.body.group, req.body.assignedQualIds, req.params.id))));
app.delete('/api/qualification-groups/:id', handleRequest(async (req, res) => {
    await db.deleteQualificationGroup(req.params.id);
    res.status(204).send();
}));

// Trunks
app.get('/api/trunks', handleRequest(async (req, res) => res.json(await db.getTrunks())));
app.post('/api/trunks', handleRequest(async (req, res) => res.status(201).json(await db.saveTrunk(req.body))));
app.put('/api/trunks/:id', handleRequest(async (req, res) => res.json(await db.saveTrunk(req.body, req.params.id))));
app.delete('/api/trunks/:id', handleRequest(async (req, res) => {
    await db.deleteTrunk(req.params.id);
    res.status(204).send();
}));

// DIDs
app.get('/api/dids', handleRequest(async (req, res) => res.json(await db.getDids())));
app.post('/api/dids', handleRequest(async (req, res) => res.status(201).json(await db.saveDid(req.body))));
app.put('/api/dids/:id', handleRequest(async (req, res) => res.json(await db.saveDid(req.body, req.params.id))));
app.delete('/api/dids/:id', handleRequest(async (req, res) => {
    await db.deleteDid(req.params.id);
    res.status(204).send();
}));

// Sites
app.get('/api/sites', handleRequest(async (req, res) => res.json(await db.getSites())));
app.post('/api/sites', handleRequest(async (req, res) => res.status(201).json(await db.saveSite(req.body))));
app.put('/api/sites/:id', handleRequest(async (req, res) => res.json(await db.saveSite(req.body, req.params.id))));
app.delete('/api/sites/:id', handleRequest(async (req, res) => {
    await db.deleteSite(req.params.id);
    res.status(204).send();
}));

// Audio Files
app.get('/api/audio-files', handleRequest(async (req, res) => res.json(await db.getAudioFiles())));
app.post('/api/audio-files', handleRequest(async (req, res) => res.status(201).json(await db.saveAudioFile(req.body))));
app.put('/api/audio-files/:id', handleRequest(async (req, res) => res.json(await db.saveAudioFile(req.body, req.params.id))));
app.delete('/api/audio-files/:id', handleRequest(async (req, res) => {
    await db.deleteAudioFile(req.params.id);
    res.status(204).send();
}));

// Planning
app.get('/api/planning-events', handleRequest(async (req, res) => res.json(await db.getPlanningEvents())));
app.post('/api/planning-events', handleRequest(async (req, res) => res.status(201).json(await db.savePlanningEvent(req.body))));
app.put('/api/planning-events/:id', handleRequest(async (req, res) => res.json(await db.savePlanningEvent(req.body, req.params.id))));
app.delete('/api/planning-events/:id', handleRequest(async (req, res) => {
    await db.deletePlanningEvent(req.params.id);
    res.status(204).send();
}));

// --- Start the API server ---
app.listen(API_PORT, () => {
    console.log(`API Server listening on port ${API_PORT}`);
});
