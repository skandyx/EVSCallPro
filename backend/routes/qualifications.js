// backend/routes/qualifications.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// --- Qualifications ---
router.post('/', async (req, res) => {
    try {
        const newQual = await db.saveQualification(req.body);
        res.status(201).json(newQual);
    } catch (error) { res.status(500).json({ error: 'Failed to save qualification' }); }
});
router.put('/:id', async (req, res) => {
    try {
        const updatedQual = await db.saveQualification(req.body, req.params.id);
        res.json(updatedQual);
    } catch (error) { res.status(500).json({ error: 'Failed to save qualification' }); }
});
router.delete('/:id', async (req, res) => {
    try {
        await db.deleteQualification(req.params.id);
        res.status(204).send();
    } catch (error) { res.status(500).json({ error: 'Failed to delete qualification' }); }
});

// --- Qualification Groups ---
router.post('/groups', async (req, res) => {
    try {
        const { assignedQualIds, ...group } = req.body;
        const newGroup = await db.saveQualificationGroup(group, assignedQualIds);
        res.status(201).json(newGroup);
    } catch (error) { res.status(500).json({ error: 'Failed to save group' }); }
});
router.put('/groups/:id', async (req, res) => {
    try {
        const { assignedQualIds, ...group } = req.body;
        const updatedGroup = await db.saveQualificationGroup(group, assignedQualIds, req.params.id);
        res.json(updatedGroup);
    } catch (error) { res.status(500).json({ error: 'Failed to save group' }); }
});
router.delete('/groups/:id', async (req, res) => {
    try {
        await db.deleteQualificationGroup(req.params.id);
        res.status(204).send();
    } catch (error) { res.status(500).json({ error: 'Failed to delete group' }); }
});


module.exports = router;
