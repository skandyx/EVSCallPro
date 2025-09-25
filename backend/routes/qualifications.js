const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Qualifications
router.post('/', async (req, res) => {
    try {
        const newQual = await db.saveQualification(req.body);
        res.status(201).json(newQual);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const updatedQual = await db.saveQualification(req.body, req.params.id);
        res.json(updatedQual);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await db.deleteQualification(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Qualification Groups
router.post('/qualification-groups', async (req, res) => {
    try {
        const { assignedQualIds, ...group } = req.body;
        const newGroup = await db.saveQualificationGroup(group, assignedQualIds);
        res.status(201).json(newGroup);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.put('/qualification-groups/:id', async (req, res) => {
    try {
        const { assignedQualIds, ...group } = req.body;
        const updatedGroup = await db.saveQualificationGroup(group, assignedQualIds, req.params.id);
        res.json(updatedGroup);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.delete('/qualification-groups/:id', async (req, res) => {
    try {
        await db.deleteQualificationGroup(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;
