
const express = require('express');
const router = express.Router();
const db = require('../services/db');

/**
 * @openapi
 * /scripts:
 *   post:
 *     summary: Crée un nouveau script d'agent.
 *     tags: [Scripts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Script' }
 *     responses:
 *       201:
 *         description: Script créé.
 */
router.post('/', async (req, res) => {
    try {
        const newScript = await db.saveScript(req.body);
        res.status(201).json(newScript);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /scripts/{id}:
 *   put:
 *     summary: Met à jour un script d'agent.
 *     tags: [Scripts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Script' }
 *     responses:
 *       200:
 *         description: Script mis à jour.
 */
router.put('/:id', async (req, res) => {
    try {
        const updatedScript = await db.saveScript(req.body, req.params.id);
        res.json(updatedScript);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /scripts/{id}:
 *   delete:
 *     summary: Supprime un script d'agent.
 *     tags: [Scripts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Script supprimé.
 */
router.delete('/:id', async (req, res) => {
    try {
        await db.deleteScript(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /scripts/{id}/duplicate:
 *   post:
 *     summary: Duplique un script d'agent.
 *     tags: [Scripts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Script dupliqué.
 */
router.post('/:id/duplicate', async (req, res) => {
    try {
        const duplicatedScript = await db.duplicateScript(req.params.id);
        res.status(201).json(duplicatedScript);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
