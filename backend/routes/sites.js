// backend/routes/sites.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.post('/', async (req, res) => {
    try { res.status(201).json(await db.saveSite(req.body)); }
    catch (e) { res.status(500).json({ error: 'Failed to save site' }); }
});
router.put('/:id', async (req, res) => {
    try { res.json(await db.saveSite(req.body, req.params.id)); }
    catch (e) { res.status(500).json({ error: 'Failed to save site' }); }
});
router.delete('/:id', async (req, res) => {
    try { await db.deleteSite(req.params.id); res.status(204).send(); }
    catch (e) { res.status(500).json({ error: 'Failed to delete site' }); }
});

module.exports = router;
