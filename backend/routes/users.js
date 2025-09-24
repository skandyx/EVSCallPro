// backend/routes/users.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

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
 *           schema:
 *             type: object
 *             properties:
 *               groupIds: { type: array, items: { type: 'string' } }
 *               user: { $ref: '#/components/schemas/User' }
 *     responses:
 *       201:
 *         description: Utilisateur créé.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/User' } } }
 */
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
 *           schema:
 *             type: object
 *             properties:
 *               groupIds: { type: array, items: { type: 'string' } }
 *               user: { $ref: '#/components/schemas/User' }
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/User' } } }
 */
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
 *         description: Utilisateur supprimé.
 */
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