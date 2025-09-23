const db = require('./services/db');
const { executeFlow } = require('./services/ivr-executor.js');

/**
 * Handles the logic for a single AGI call session.
 * @param {object} context The agi-node context object.
 * @param {object} vars The initial AGI variables.
 */
async function handleCall(context, vars) {
  try {
    await context.answer();
    await context.verbose('AGI Script Started.');

    const dnid = vars.agi_network_script || vars.agi_dnid || 'default';
    await context.verbose(`Call received for DNID: ${dnid}`);

    const ivrFlow = await db.getIvrFlowByDnid(dnid);

    if (ivrFlow) {
      await executeFlow(context, ivrFlow);
    } else {
      await context.verbose('No IVR flow configured for this number.');
      // Using exec with TextToSpeech as a replacement for the proprietary sayText method.
      await context.exec('TextToSpeech', '"We are sorry, this service is currently unavailable."');
    }

  } catch (err) {
    console.error('An unhandled error occurred in agiHandler:', err);
    try {
        await context.verbose('An unexpected error occurred.');
    } catch (e) {
        console.error('Could not even send verbose error message to Asterisk', e);
    }
  } finally {
    await context.verbose('AGI Script Finished.');
    await context.hangup();
  }
}


/**
 * Main handler for incoming AGI connections from agi-node.
 * This function sets up listeners for the AGI context events.
 * @param {object} context The agi-node context object (which is an EventEmitter).
 */
function agiConnectionHandler(context) {
    context.on('variables', (vars) => {
        handleCall(context, vars);
    });

    context.on('error', (err) => {
        console.error('AGI Context Error:', err);
    });
}

module.exports = agiConnectionHandler;
