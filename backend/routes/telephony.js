
const express = require('express');
const router = express.Router();
const db = require('../services/db');

/**
 * @openapi
 * tags:
 *   - name: Téléphonie
 *     description: Gestion des Trunks SIP et des numéros (SDA).
 */

/**
 * @openapi
 * /trunks:
 *   post:
 *     summary: Crée un nouveau Trunk SIP.
 *     tags: [Téléphonie]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Trunk' }
 *     responses:
 *       201:
 *         description: Trunk créé.
 */
router.post('/trunks', async (req, res) => {
    try {
        const newTrunk = await db.saveTrunk(req.body);
        res.status(201).json(newTrunk);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /trunks/{id}:
 *   put:
 *     summary: Met à jour un Trunk SIP.
 *     tags: [Téléphonie]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Trunk' }
 *     responses:
 *       200:
 *         description: Trunk mis à jour.
 */
router.put('/trunks/:id', async (req, res) => {
    try {
        const updatedTrunk = await db.saveTrunk(req.body, req.params.id);
        res.json(updatedTrunk);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /trunks/{id}:
 *   delete:
 *     summary: Supprime un Trunk SIP.
 *     tags: [Téléphonie]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Trunk supprimé.
 */
router.delete('/trunks/:id', async (req, res) => {
    try {
        await db.deleteTrunk(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /dids:
 *   post:
 *     summary: Crée un nouveau numéro (SDA).
 *     tags: [Téléphonie]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Did' }
 *     responses:
 *       201:
 *         description: Numéro créé.
 */
router.post('/dids', async (req, res) => {
    try {
        const newDid = await db.saveDid(req.body);
        res.status(201).json(newDid);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /dids/{id}:
 *   put:
 *     summary: Met à jour un numéro (SDA).
 *     tags: [Téléphonie]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Did' }
 *     responses:
 *       200:
 *         description: Numéro mis à jour.
 */
router.put('/dids/:id', async (req, res) => {
    try {
        const updatedDid = await db.saveDid(req.body, req.params.id);
        res.json(updatedDid);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /dids/{id}:
 *   delete:
 *     summary: Supprime un numéro (SDA).
 *     tags: [Téléphonie]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Numéro supprimé.
 */
router.delete('/dids/:id', async (req, res) => {
    try {
        await db.deleteDid(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
