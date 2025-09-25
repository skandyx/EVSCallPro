const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.post('/', async (req, res) => {
    try {
        const newCampaign = await db.saveCampaign(req.body);
        res.status(201).json(newCampaign);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const updatedCampaign = await db.saveCampaign(req.body, req.params.id);
        res.json(updatedCampaign);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await db.deleteCampaign(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:id/contacts', async (req, res) => {
    try {
        const { contacts, deduplicationConfig } = req.body;
        await db.importContacts(req.params.id, contacts, deduplicationConfig);
        res.status(201).json({ message: 'Contacts imported successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/next-contact', async (req, res) => {
    try {
        const { agentId } = req.body;
        const result = await db.getNextContactForCampaign(agentId);
        res.json(result);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;
