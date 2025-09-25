const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Qualify a contact
router.post('/:id/qualify', async (req, res) => {
    try {
        await db.qualifyContact(req.params.id, req.body);
        res.status(200).json({ message: 'Contact qualified.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a note to a contact
router.post('/:id/notes', async (req, res) => {
    try {
        const noteData = { ...req.body, contactId: req.params.id };
        const newNote = await db.createNote(noteData);
        res.status(201).json(newNote);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;
