const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.post('/', async (req, res) => {
    try {
        const newSite = await db.saveSite(req.body);
        res.status(201).json(newSite);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const updatedSite = await db.saveSite(req.body, req.params.id);
        res.json(updatedSite);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await db.deleteSite(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
