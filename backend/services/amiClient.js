const AsteriskManager = require('asterisk-manager');

let ami = null;

/**
 * Creates and returns a singleton instance of the Asterisk Manager client.
 * This ensures that the entire application uses a single, persistent connection.
 * @returns {AsteriskManager} The AMI client instance.
 */
const getAmiClient = () => {
    if (!ami) {
        console.log('[AMI Client] Initializing new AMI connection...');
        ami = new AsteriskManager(
            process.env.AMI_PORT,
            process.env.AMI_HOST,
            process.env.AMI_USER,
            process.env.AMI_SECRET,
            true // Enable reconnection
        );
        ami.keepConnected();
        
        // It's good practice to log connection events for debugging.
        ami.on('connect', () => console.log('[AMI Client] Connected.'));
        ami.on('disconnect', () => console.warn('[AMI Client] Disconnected.'));
        ami.on('reconnection', () => console.log('[AMI Client] Reconnecting...'));
        ami.on('internalError', (error) => console.error('[AMI Client] Internal Error:', error));
    }
    return ami;
};

// Export the singleton instance
module.exports = getAmiClient();
