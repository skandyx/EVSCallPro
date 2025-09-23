// Central hub for all database query modules

const authQueries = require('./auth.queries');
const userQueries = require('./user.queries');
const groupQueries = require('./group.queries');
const campaignQueries = require('./campaign.queries');
const scriptQueries = require('./script.queries');
const ivrQueries = require('./ivr.queries');
const qualificationQueries = require('./qualification.queries');
const telephonyQueries = require('./telephony.queries');
const siteQueries = require('./site.queries');
const mediaQueries = require('./media.queries');
const planningQueries = require('./planning.queries');
const noteQueries = require('./note.queries');
const pbxQueries = require('./db/pbx.queries');


module.exports = {
    ...authQueries,
    ...userQueries,
    ...groupQueries,
    ...campaignQueries,
    ...scriptQueries,
    ...ivrQueries,
    ...qualificationQueries,
    ...telephonyQueries,
    ...siteQueries,
    ...mediaQueries,
    ...planningQueries,
    ...noteQueries,
    ...pbxQueries,
};
