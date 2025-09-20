const db = require('./services/db.js');
const { executeFlow } = require('./services/ivr-executor.js');

/**
 * Main handler for incoming AGI calls.
 * @param {object} context The fast-agi context object.
 */
async function agiHandler(context) {
  try {
    await context.answer();
    await context.verbose('AGI Script Started.');

    const dnid = context.network_script || context.request.dnid || 'default';
    await context.verbose(`Call received for DNID: ${dnid}`);

    const ivrFlow = await db.getIvrFlowByDnid(dnid);

    if (ivrFlow) {
      await executeFlow(context, ivrFlow);
    } else {
      await context.verbose('No IVR flow configured for this number.');
      await context.sayText('We are sorry, this service is currently unavailable.');
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

module.exports = agiHandler;
