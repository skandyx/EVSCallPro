// backend/routes/ivr.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.post('/', async (req, res) => {
    try {
        const newFlow = await db.saveIvrFlow(req.body);
        res.status(201).json(newFlow);
    } catch (error) { res.status(500).json({ error: 'Failed to save IVR flow' }); }
});
router.put('/:id', async (req, res) => {
    try {
        const updatedFlow = await db.saveIvrFlow(req.body, req.params.id);
        res.json(updatedFlow);
    } catch (error) { res.status(500).json({ error: 'Failed to save IVR flow' }); }
});
router.delete('/:id', async (req, res) => {
    try {
        await db.deleteIvrFlow(req.params.id);
        res.status(204).send();
    } catch (error) { res.status(500).json({ error: 'Failed to delete IVR flow' }); }
});
router.post('/:id/duplicate', async (req, res) => {
    try {
        const duplicatedFlow = await db.duplicateIvrFlow(req.params.id);
        res.status(201).json(duplicatedFlow);
    } catch (error) { res.status(500).json({ error: 'Failed to duplicate IVR flow' }); }
});

module.exports = router;
