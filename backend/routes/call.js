const express = require('express');
const router = express.Router();
const db = require('../services/db');
const yeastarClient = require('../services/yeastarClient');
const asteriskRouter = require('../services/asteriskRouter');

/**
 * @openapi
 * /call/originate:
 *   post:
 *     summary: Lance un appel sortant pour un agent.
 *     tags: [Campagnes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               agentId: { type: string }
 *               destination: { type: string }
 *     responses:
 *       200:
 *         description: Appel initié avec succès.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { callId: { type: string } } }
 *       404:
 *         description: Agent, site ou configuration PBX non trouvé.
 *       500:
 *         description: Erreur lors de l'initiation de l'appel.
 */
router.post('/originate', async (req, res) => {
    const { agentId, destination } = req.body;

    try {
        const agent = await db.getUserById(agentId);
        if (!agent) {
            return res.status(404).json({ error: "Agent non trouvé." });
        }

        if (process.env.PBX_CONNECTION_MODE === 'ASTERISK_AMI') {
            // --- NOUVELLE LOGIQUE ASTERISK ---
            if (!agent.extension || !agent.siteId) {
                return res.status(404).json({ error: "L'agent n'a pas d'extension ou de site configuré." });
            }
            const callResult = await asteriskRouter.originateCall(agent.extension, destination, agent.siteId);
            res.json({ callId: callResult.uniqueid });

        } else {
            // --- ANCIENNE LOGIQUE YEASTAR API ---
            if (!agent.siteId) {
                return res.status(404).json({ error: "L'agent n'est assigné à aucun site." });
            }
            const pbxConfig = await db.getPbxConfigBySiteId(agent.siteId);
            if (!pbxConfig) {
                return res.status(404).json({ error: "Configuration PBX non trouvée pour le site de l'agent." });
            }
            const client = await yeastarClient.getClient(pbxConfig);
            // Pour le click-to-call, la destination est le numéro du client.
            // L'extension de l'agent est la source de l'appel.
            // Le callerId est défini dans la campagne.
            const callerId = 'CRM'; // À récupérer de la campagne si nécessaire
            const callResult = await client.originate(agent.loginId, destination, callerId);
            res.json({ callId: callResult.call_id });
        }
    } catch (error) {
        console.error('Originate call failed:', error.message);
        res.status(500).json({ error: `Erreur lors du lancement de l'appel: ${error.message}` });
    }
});

module.exports = router;
