// backend/routes/telephony.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// --- Trunks ---
router.post('/trunks', async (req, res) => {
    try { res.status(201).json(await db.saveTrunk(req.body)); }
    catch (e) { res.status(500).json({ error: 'Failed to save trunk' }); }
});
router.put('/trunks/:id', async (req, res) => {
    try { res.json(await db.saveTrunk(req.body, req.params.id)); }
    catch (e) { res.status(500).json({ error: 'Failed to save trunk' }); }
});
router.delete('/trunks/:id', async (req, res) => {
    try { await db.deleteTrunk(req.params.id); res.status(204).send(); }
    catch (e) { res.status(500).json({ error: 'Failed to delete trunk' }); }
});

// --- DIDs ---
router.post('/dids', async (req, res) => {
    try { res.status(201).json(await db.saveDid(req.body)); }
    catch (e) { res.status(500).json({ error: 'Failed to save DID' }); }
});
router.put('/dids/:id', async (req, res) => {
    try { res.json(await db.saveDid(req.body, req.params.id)); }
    catch (e) { res.status(500).json({ error: 'Failed to save DID' }); }
});
router.delete('/dids/:id', async (req, res) => {
    try { await db.deleteDid(req.params.id); res.status(204).send(); }
    catch (e) { res.status(500).json({ error: 'Failed to delete DID' }); }
});

module.exports = router;
