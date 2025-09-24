// backend/routes/scripts.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// CREATE a script
router.post('/', async (req, res) => {
    try {
        const newScript = await db.saveScript(req.body);
        res.status(201).json(newScript);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create script' });
    }
});

// UPDATE a script
router.put('/:id', async (req, res) => {
    try {
        const updatedScript = await db.saveScript(req.body, req.params.id);
        res.json(updatedScript);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update script' });
    }
});

// DELETE a script
router.delete('/:id', async (req, res) => {
    try {
        await db.deleteScript(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to delete script' });
    }
});

// DUPLICATE a script
router.post('/:id/duplicate', async (req, res) => {
    try {
        const duplicatedScript = await db.duplicateScript(req.params.id);
        res.status(201).json(duplicatedScript);
    } catch (error) {
        res.status(500).json({ error: 'Failed to duplicate script' });
    }
});

module.exports = router;
