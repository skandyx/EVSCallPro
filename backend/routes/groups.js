
const express = require('express');
const router = express.Router();
const db = require('../services/db');

/**
 * @openapi
 * /user-groups:
 *   post:
 *     summary: Crée un nouveau groupe d'utilisateurs.
 *     tags: [Utilisateurs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UserGroup' }
 *     responses:
 *       201:
 *         description: Groupe créé.
 */
router.post('/', async (req, res) => {
    try {
        const newGroup = await db.saveUserGroup(req.body);
        res.status(201).json(newGroup);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /user-groups/{id}:
 *   put:
 *     summary: Met à jour un groupe d'utilisateurs.
 *     tags: [Utilisateurs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UserGroup' }
 *     responses:
 *       200:
 *         description: Groupe mis à jour.
 */
router.put('/:id', async (req, res) => {
    try {
        const updatedGroup = await db.saveUserGroup(req.body, req.params.id);
        res.json(updatedGroup);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /user-groups/{id}:
 *   delete:
 *     summary: Supprime un groupe d'utilisateurs.
 *     tags: [Utilisateurs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Groupe supprimé.
 */
router.delete('/:id', async (req, res) => {
    try {
        await db.deleteUserGroup(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
