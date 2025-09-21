const pool = require('./connection');
const { keysToCamel, parseScriptOrFlow } = require('./utils');

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

const getAllApplicationData = async () => {
    const [
        sitesRes, usersRes, userGroupsRes, campaignsRes, scriptsRes, ivrFlowsRes,
        qualificationsRes, qualificationGroupsRes, trunksRes, didsRes, audioFilesRes,
        planningEventsRes, personalCallbacksRes, activityTypesRes,
        userGroupMembersRes, campaignAgentsRes, contactsRes
    ] = await Promise.all([
        pool.query('SELECT * FROM sites ORDER BY name'),
        pool.query('SELECT id, login_id, first_name, last_name, email, "role", is_active, site_id, created_at, updated_at FROM users ORDER BY first_name, last_name'),
        pool.query('SELECT * FROM user_groups ORDER BY name'),
        pool.query('SELECT * FROM campaigns ORDER BY name'),
        pool.query('SELECT * FROM scripts ORDER BY name'),
        pool.query('SELECT * FROM ivr_flows ORDER BY name'),
        pool.query('SELECT * FROM qualifications ORDER BY code'),
        pool.query('SELECT * FROM qualification_groups ORDER BY name'),
        pool.query('SELECT * FROM trunks ORDER BY name'),
        pool.query('SELECT * FROM dids ORDER BY number'),
        pool.query('SELECT * FROM audio_files ORDER BY name'),
        pool.query('SELECT * FROM planning_events'),
        pool.query('SELECT * FROM personal_callbacks'),
        pool.query('SELECT * FROM activity_types ORDER BY name'),
        pool.query('SELECT * FROM user_group_members'),
        pool.query('SELECT * FROM campaign_agents'),
        pool.query('SELECT * FROM contacts')
    ]);

    const users = usersRes.rows.map(keysToCamel);
    const userGroups = userGroupsRes.rows.map(keysToCamel);
    const campaigns = campaignsRes.rows.map(keysToCamel);
    const contacts = contactsRes.rows.map(keysToCamel);

    // Attach memberships and contacts
    const usersWithMemberships = users.map(user => ({
        ...user,
        campaignIds: campaignAgentsRes.rows.filter(ca => ca.user_id === user.id).map(ca => ca.campaign_id),
    }));

    const groupsWithMembers = userGroups.map(group => ({
        ...group,
        memberIds: userGroupMembersRes.rows.filter(ugm => ugm.group_id === group.id).map(ugm => ugm.user_id),
    }));
    
    const campaignsWithContacts = campaigns.map(c => ({
        ...c,
        contacts: contacts.filter(co => co.campaign_id === c.id)
    }));


    return {
        sites: sitesRes.rows.map(keysToCamel),
        users: usersWithMemberships,
        userGroups: groupsWithMembers,
        campaigns: campaignsWithContacts,
        savedScripts: scriptsRes.rows.map(parseScriptOrFlow),
        savedIvrFlows: ivrFlowsRes.rows.map(parseScriptOrFlow),
        qualifications: qualificationsRes.rows.map(keysToCamel),
        qualificationGroups: qualificationGroupsRes.rows.map(keysToCamel),
        trunks: trunksRes.rows.map(keysToCamel),
        dids: didsRes.rows.map(keysToCamel),
        audioFiles: audioFilesRes.rows.map(keysToCamel),
        planningEvents: planningEventsRes.rows.map(keysToCamel),
        personalCallbacks: personalCallbacksRes.rows.map(keysToCamel),
        activityTypes: activityTypesRes.rows.map(keysToCamel)
    };
};

module.exports = {
    getAllApplicationData,
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
};