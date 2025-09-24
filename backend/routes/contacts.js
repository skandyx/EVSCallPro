// backend/routes/contacts.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Qualify a contact
router.post('/:id/qualify', async (req, res) => {
    try {
        await db.qualifyContact(req.params.id, req.body);
        res.status(200).json({ message: 'Contact qualified' });
    } catch (error) {
        console.error('Error qualifying contact:', error);
        res.status(500).json({ error: 'Failed to qualify contact' });
    }
});

// Add a note to a contact
router.post('/:id/notes', async (req, res) => {
    try {
        const noteData = { contactId: req.params.id, ...req.body };
        const newNote = await db.createNote(noteData);
        res.status(201).json(newNote);
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({ error: 'Failed to create note' });
    }
});

module.exports = router;
