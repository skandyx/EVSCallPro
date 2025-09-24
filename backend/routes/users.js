// backend/routes/users.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// CREATE a new user
router.post('/', async (req, res) => {
    try {
        const { groupIds, ...user } = req.body;
        const newUser = await db.createUser(user, groupIds);
        res.status(201).json(newUser);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// UPDATE a user
router.put('/:id', async (req, res) => {
    try {
        const { groupIds, ...user } = req.body;
        const updatedUser = await db.updateUser(req.params.id, user, groupIds);
        res.json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// DELETE a user
router.delete('/:id', async (req, res) => {
    try {
        await db.deleteUser(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = router;
