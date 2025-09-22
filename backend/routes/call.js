// backend/routes/call.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');
const YeastarClient = require('../services/yeastarClient');

const PBX_CONNECTION_MODE = process.env.PBX_CONNECTION_MODE || 'asterisk_ami';
let asteriskRouter;
if (PBX_CONNECTION_MODE === 'asterisk_ami') {
    asteriskRouter = require('../services/asteriskRouter');
}

/**
 * @openapi
 * /call/originate:
 *   post:
 *     tags:
 *       - Click-to-Call
 *     summary: Lance un appel sortant pour un agent.
 *     description: Déclenche un appel du PBX vers l'agent, puis vers la destination finale.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               agentId:
 *                 type: string
 *               destination:
 *                 type: string
 *     responses:
 *       200:
 *         description: Appel initié avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pbxCallId:
 *                   type: string
 *       400:
 *         description: Informations manquantes ou invalides.
 *       404:
 *         description: Agent ou site introuvable.
 *       500:
 *         description: Erreur interne ou échec de communication avec le PBX.
 */
router.post('/originate', async (req, res) => {
    const { agentId, destination } = req.body;
    if (!agentId || !destination) {
        return res.status(400).json({ error: "agentId et destination sont requis." });
    }

    try {
        const agent = await db.getUserById(agentId);
        if (!agent) {
            return res.status(404).json({ error: "Agent non trouvé." });
        }
        if (!agent.siteId) {
            return res.status(400).json({ error: "L'agent n'est assigné à aucun site." });
        }

        // --- [NOUVEAU] Logique de bascule ---
        if (PBX_CONNECTION_MODE === 'asterisk_ami') {
            // Mode Asterisk Central
            const result = await asteriskRouter.originateCall(agent, destination);
            res.status(200).json(result);
        } else {
            // Mode API Yeastar (Ancien mode)
            const pbxConfig = await db.getPbxConfigBySiteId(agent.siteId);
            if (!pbxConfig) {
                return res.status(404).json({ error: "Configuration PBX pour le site de l'agent non trouvée." });
            }

            const client = new YeastarClient(pbxConfig, db);
            const campaign = await db.getActiveCampaignForAgent(agentId);
            const callerId = campaign ? campaign.caller_id : '0000000000';

            const result = await client.originate(agent.extension, destination, callerId);
            res.status(200).json(result);
        }

    } catch (error) {
        console.error("Erreur lors de l'origination de l'appel :", error.message);
        res.status(500).json({ error: "Échec de l'initiation de l'appel", details: error.message });
    }
});

module.exports = router;
