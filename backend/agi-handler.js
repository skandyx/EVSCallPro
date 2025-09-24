const db = require('./services/db');
const { executeFlow } = require('./services/ivr-executor.js');

/**
 * Handles an AGI request using the 'agi-async' library.
 * This async function receives a channel object for the call.
 * @param {object} channel The 'agi-async' channel object.
 */
async function agiHandler(channel) {
  try {
    const vars = channel.variables;
    await channel.answer();
    await channel.verbose('AGI Script Started.');

    const dnid = vars.agi_network_script || vars.agi_dnid || 'default';
    await channel.verbose(`Call received for DNID: ${dnid}`);

    const ivrFlow = await db.getIvrFlowByDnid(dnid);

    if (ivrFlow) {
      await executeFlow(channel, ivrFlow);
    } else {
      await channel.verbose('No IVR flow configured for this number.');
      await channel.exec('TextToSpeech', '"We are sorry, this service is currently unavailable."');
    }

  } catch (err) {
    console.error('An unhandled error occurred in agiHandler:', err);
    try {
        await channel.verbose('An unexpected error occurred.');
    } catch (e) {
        console.error('Could not even send verbose error message to Asterisk', e);
    }
  } finally {
    // Ensure hangup is always called, even if the flow fails
    await channel.verbose('AGI Script Finished.');
    await channel.hangup();
  }
}

module.exports = agiHandler;