const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.get('/', async (req, res) => {
    try {
        const users = await db.getUsers();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { groupIds, ...user } = req.body;
        const newUser = await db.createUser(user, groupIds);
        res.status(201).json(newUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { groupIds, ...user } = req.body;
        const updatedUser = await db.updateUser(req.params.id, user, groupIds);
        res.json(updatedUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await db.deleteUser(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
