// backend/routes/groups.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// CREATE a new group
router.post('/', async (req, res) => {
    try {
        const group = req.body;
        const newGroup = await db.saveUserGroup(group);
        res.status(201).json(newGroup);
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});

// UPDATE a group
router.put('/:id', async (req, res) => {
    try {
        const group = req.body;
        const updatedGroup = await db.saveUserGroup(group, req.params.id);
        res.json(updatedGroup);
    } catch (error) {
        console.error('Error updating group:', error);
        res.status(500).json({ error: 'Failed to update group' });
    }
});

// DELETE a group
router.delete('/:id', async (req, res) => {
    try {
        await db.deleteUserGroup(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting group:', error);
        res.status(500).json({ error: 'Failed to delete group' });
    }
});

module.exports = router;
