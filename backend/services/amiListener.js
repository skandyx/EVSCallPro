const ami = require('./amiClient'); // Use the shared client instance
const db = require('./db');
const { broadcastToRoom } = require('./webSocketServer');

const agentMap = new Map(); // Map<extension, userId>

/**
 * Initialise la connexion à l'interface AMI d'Asterisk et configure les écouteurs d'événements.
 */
async function initializeAmiListener() {
    console.log('[AMI] Initializing AMI Listener...');

    // Pré-charger la correspondance entre extensions et IDs d'utilisateurs
    try {
        const users = await db.getUsers();
        users.forEach(user => {
            if (user.extension) {
                agentMap.set(user.extension, user.id);
            }
        });
        console.log(`[AMI] Pre-loaded ${agentMap.size} agent extensions.`);
    } catch (error) {
        console.error('[AMI] Failed to pre-load agent extensions:', error);
        // On continue quand même, les nouveaux logins mettront à jour la map.
    }

    // The connection is handled by amiClient.js. We just attach our event listener.
    ami.on('managerevent', (evt) => {
        handleAmiEvent(evt);
    });
    
    // Log to confirm listener is attached
    if (ami.isConnected()) {
        console.log('[AMI Listener] Listener attached to already connected client.');
    } else {
        ami.on('connect', () => console.log('[AMI Listener] Listener ready on client connect.'));
    }
}

/**
 * Traite les événements reçus de l'AMI et les transforme en événements métier.
 * @param {object} evt - L'événement brut de l'AMI.
 */
function handleAmiEvent(evt) {
    // console.log('[AMI] Event received:', evt); // Décommenter pour un débogage intensif
    
    const eventName = evt.event ? evt.event.toLowerCase() : '';
    
    // Exemple de mapping d'événement : un agent change d'état
    if (eventName === 'agentstatus') {
        const agentId = agentMap.get(evt.agent);
        if (agentId) {
            const agentStatusUpdate = {
                type: 'agentStatusUpdate',
                payload: {
                    agentId: agentId,
                    status: mapAgentStatus(evt.status), // Convertir le statut AMI en statut métier
                    // ... autres données à extraire de l'événement
                }
            };
            broadcastToRoom('superviseur', agentStatusUpdate);
        }
    }

    // Un nouvel appel arrive sur un agent
    if (eventName === 'agentcalled') {
        const agentId = agentMap.get(evt.agentcalled);
        if (agentId) {
            const newCallEvent = {
                type: 'newCall',
                payload: {
                    callId: evt.uniqueid,
                    agentId: agentId,
                    caller: evt.calleridnum,
                    direction: evt.context.includes('out') ? 'outbound' : 'inbound',
                    campaignId: evt.variable ? evt.variable.find(v => v.startsWith('campaignId='))?.split('=')[1] : null,
                    timestamp: new Date().toISOString()
                }
            };
            broadcastToRoom('superviseur', newCallEvent);
        }
    }
    
    // Un appel est raccroché
    if (eventName === 'hangup') {
        const hangupEvent = {
            type: 'callHangup',
            payload: {
                callId: evt.uniqueid,
                duration: evt.billableseconds || 0,
                // ... on pourrait récupérer la qualification via une variable de canal
            }
        };
        broadcastToRoom('superviseur', hangupEvent);
    }
}

/**
 * Traduit les statuts AMI en statuts compréhensibles par le frontend.
 * @param {string} amiStatus - Le statut brut de l'AMI.
 * @returns {string} Le statut métier.
 */
function mapAgentStatus(amiStatus) {
    switch(amiStatus) {
        case 'AGENT_IDLE':
        case 'AGENT_LOGGEDOFF':
            return 'En Attente';
        case 'AGENT_ONCALL':
            return 'En Appel';
        case 'AGENT_RINGING':
            return 'En Appel'; // Simplification
        case 'AGENT_UNAVAILABLE':
            return 'En Pause';
        default:
            return 'Inconnu';
    }
}

module.exports = {
    initializeAmiListener,
};
