const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Trunks
router.post('/trunks', async (req, res) => {
    try {
        const newTrunk = await db.saveTrunk(req.body);
        res.status(201).json(newTrunk);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.put('/trunks/:id', async (req, res) => {
    try {
        const updatedTrunk = await db.saveTrunk(req.body, req.params.id);
        res.json(updatedTrunk);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.delete('/trunks/:id', async (req, res) => {
    try {
        await db.deleteTrunk(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DIDs
router.post('/dids', async (req, res) => {
    try {
        const newDid = await db.saveDid(req.body);
        res.status(201).json(newDid);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.put('/dids/:id', async (req, res) => {
    try {
        const updatedDid = await db.saveDid(req.body, req.params.id);
        res.json(updatedDid);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.delete('/dids/:id', async (req, res) => {
    try {
        await db.deleteDid(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
