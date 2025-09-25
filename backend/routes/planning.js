const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.post('/', async (req, res) => {
    try {
        const newEvent = await db.savePlanningEvent(req.body);
        res.status(201).json(newEvent);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const updatedEvent = await db.savePlanningEvent(req.body, req.params.id);
        res.json(updatedEvent);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await db.deletePlanningEvent(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
