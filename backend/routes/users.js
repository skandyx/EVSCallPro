
const express = require('express');
const router = express.Router();
const db = require('../services/db');

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Récupère la liste de tous les utilisateurs.
 *     tags: [Utilisateurs]
 *     responses:
 *       200:
 *         description: Une liste d'utilisateurs.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/User' }
 */
router.get('/', async (req, res) => {
    try {
        const users = await db.getUsers();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Crée un nouvel utilisateur.
 *     tags: [Utilisateurs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/User' }
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès.
 */
router.post('/', async (req, res) => {
    try {
        const { groupIds, ...user } = req.body;
        const newUser = await db.createUser(user, groupIds);
        res.status(201).json(newUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /users/{id}:
 *   put:
 *     summary: Met à jour un utilisateur existant.
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
 *           schema: { $ref: '#/components/schemas/User' }
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour.
 */
router.put('/:id', async (req, res) => {
    try {
        const { groupIds, ...user } = req.body;
        const updatedUser = await db.updateUser(req.params.id, user, groupIds);
        res.json(updatedUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     summary: Supprime un utilisateur.
 *     tags: [Utilisateurs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Utilisateur supprimé avec succès.
 */
router.delete('/:id', async (req, res) => {
    try {
        await db.deleteUser(req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
