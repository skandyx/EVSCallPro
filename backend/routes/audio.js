
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Ces routes sont des placeholders pour correspondre à ce que le frontend attend.
// La logique de récupération principale se fait dans /application-data

/**
 * @openapi
 * /audio-files:
 *   post:
 *     summary: Crée un nouveau fichier audio (métadonnées).
 *     tags: [Média]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AudioFile' }
 *     responses:
 *       201:
 *         description: Fichier audio créé.
 */
router.post('/', async (req, res) => {
    try {
        const newFile = await db.saveAudioFile(req.body);
        res.status(201).json(newFile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @openapi
 * /audio-files/{id}:
 *   put:
 *     summary: Met à jour un fichier audio (métadonnées).
 *     tags: [Média]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AudioFile' }
 *     responses:
 *       200:
 *         description: Fichier audio mis à jour.
 */
router.put('/:id', async (req, res) => {
    try {
        const updatedFile = await db.saveAudioFile(req.body, req.params.id);
        res.json(updatedFile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @openapi
 * /audio-files/{id}:
 *   delete:
 *     summary: Supprime un fichier audio.
 *     tags: [Média]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Fichier audio supprimé.
 */
router.delete('/:id', async (req, res) => {
    try {
        await db.deleteAudioFile(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
