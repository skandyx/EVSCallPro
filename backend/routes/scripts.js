const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.post('/', async (req, res) => {
    try {
        const newScript = await db.saveScript(req.body);
        res.status(201).json(newScript);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const updatedScript = await db.saveScript(req.body, req.params.id);
        res.json(updatedScript);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await db.deleteScript(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:id/duplicate', async (req, res) => {
    try {
        const duplicatedScript = await db.duplicateScript(req.params.id);
        res.status(201).json(duplicatedScript);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
