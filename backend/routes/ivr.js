
const express = require('express');
const router = express.Router();
const db = require('../services/db');

/**
 * @openapi
 * /ivr-flows:
 *   post:
 *     summary: Crée un nouveau flux SVI.
 *     tags: [SVI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/IvrFlow' }
 *     responses:
 *       201:
 *         description: Flux SVI créé.
 */
router.post('/', async (req, res) => {
    try {
        const newFlow = await db.saveIvrFlow(req.body);
        res.status(201).json(newFlow);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /ivr-flows/{id}:
 *   put:
 *     summary: Met à jour un flux SVI.
 *     tags: [SVI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/IvrFlow' }
 *     responses:
 *       200:
 *         description: Flux SVI mis à jour.
 */
router.put('/:id', async (req, res) => {
    try {
        const updatedFlow = await db.saveIvrFlow(req.body, req.params.id);
        res.json(updatedFlow);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /ivr-flows/{id}:
 *   delete:
 *     summary: Supprime un flux SVI.
 *     tags: [SVI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Flux SVI supprimé.
 */
router.delete('/:id', async (req, res) => {
    try {
        await db.deleteIvrFlow(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /ivr-flows/{id}/duplicate:
 *   post:
 *     summary: Duplique un flux SVI.
 *     tags: [SVI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Flux SVI dupliqué.
 */
router.post('/:id/duplicate', async (req, res) => {
    try {
        const duplicatedFlow = await db.duplicateIvrFlow(req.params.id);
        res.status(201).json(duplicatedFlow);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
