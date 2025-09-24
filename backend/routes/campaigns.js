// backend/routes/campaigns.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// CREATE a new campaign
router.post('/', async (req, res) => {
    try {
        const newCampaign = await db.saveCampaign(req.body);
        res.status(201).json(newCampaign);
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

// UPDATE a campaign
router.put('/:id', async (req, res) => {
    try {
        const updatedCampaign = await db.saveCampaign(req.body, req.params.id);
        res.json(updatedCampaign);
    } catch (error) {
        console.error('Error updating campaign:', error);
        res.status(500).json({ error: 'Failed to update campaign' });
    }
});

// DELETE a campaign
router.delete('/:id', async (req, res) => {
    try {
        await db.deleteCampaign(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
});

// IMPORT contacts into a campaign
router.post('/:id/contacts', async (req, res) => {
    try {
        const { contacts, deduplicationConfig } = req.body;
        await db.importContacts(req.params.id, contacts, deduplicationConfig);
        res.status(201).json({ message: 'Contacts imported successfully' });
    } catch (error) {
        console.error('Error importing contacts:', error);
        res.status(500).json({ error: 'Failed to import contacts' });
    }
});

// GET next contact for an agent
router.post('/next-contact', async (req, res) => {
    try {
        const { agentId } = req.body;
        const result = await db.getNextContactForCampaign(agentId);
        res.json(result);
    } catch (error) {
        console.error('Error getting next contact:', error);
        res.status(500).json({ error: 'Failed to get next contact' });
    }
});

module.exports = router;
