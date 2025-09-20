import type {
    User,
    UserGroup,
    SavedScript,
    Page,
    IvrFlow,
    IvrNode,
    Campaign,
    Contact,
    Qualification,
    QualificationGroup,
    Trunk,
    Did,
    BackupLog,
    BackupSchedule,
    SystemLog,
    VersionInfo,
    ConnectivityService,
    CallHistoryRecord,
    AgentSession,
    AudioFile,
    ActivityType,
    PlanningEvent,
    Site,
    PersonalCallback
} from '../types.ts';

const sites: Site[] = [
    {
        id: 'site-paris',
        name: 'Siège de Paris',
        yeastarIp: '192.168.1.100',
        apiUser: 'crm_api_paris',
    },
    {
        id: 'site-lyon',
        name: 'Agence de Lyon',
        yeastarIp: '192.168.2.100',
        apiUser: 'crm_api_lyon',
    }
];

const users: User[] = [
    {
        id: 'user-admin',
        loginId: '9000',
        firstName: 'Admin',
        lastName: 'Principal',
        email: 'admin.principal@example.com',
        role: 'Administrateur',
        isActive: true,
        campaignIds: [],
        password: '9000',
        siteId: 'site-paris'
    },
    {
        id: 'user-supervisor',
        loginId: '1000',
        firstName: 'Serge',
        lastName: 'Superviseur',
        email: 'serge.superviseur@example.com',
        role: 'Superviseur',
        isActive: true,
        campaignIds: [],
        password: '1000',
        siteId: 'site-paris'
    },
    {
        id: 'user-agent-1',
        loginId: '1001',
        firstName: 'Alice',
        lastName: 'Agent',
        email: 'alice.agent@example.com',
        role: 'Agent',
        isActive: true,
        campaignIds: ['campaign-1', 'campaign-2'],
        password: '1001',
        siteId: 'site-paris'
    },
    {
        id: 'user-agent-2',
        loginId: '1002',
        firstName: 'Bob',
        lastName: 'Acteur',
        email: 'bob.acteur@example.com',
        role: 'Agent',
        isActive: true,
        campaignIds: ['campaign-1', 'campaign-2'],
        password: 'password123',
        siteId: 'site-lyon'
    },
     {
        id: 'user-agent-3',
        loginId: '1003',
        firstName: 'Charlie',
        lastName: 'Conseiller',
        email: '',
        role: 'Agent',
        isActive: false,
        campaignIds: ['campaign-2'],
        password: 'password123',
        siteId: 'site-lyon'
    },
    {
        id: 'user-superadmin',
        loginId: '9999',
        firstName: 'Super',
        lastName: 'Admin',
        email: 'super.admin@example.com',
        role: 'SuperAdmin',
        isActive: true,
        campaignIds: [],
        password: '9999',
        siteId: 'site-paris'
    }
];

const userGroups: UserGroup[] = [
    {
        id: 'group-1',
        name: 'Ventes',
        memberIds: ['user-agent-1', 'user-agent-2']
    },
    {
        id: 'group-2',
        name: 'Support N1',
        memberIds: ['user-agent-3']
    }
];

const firstPage: Page = {
    id: `page-1659540000000`,
    name: "Page 1",
    blocks: [
        { id: 'block-1', name: 'Titre Accueil', type: 'label', x: 50, y: 30, width: 400, height: 50, content: { text: 'Bienvenue - Script de Vente' }, displayCondition: null, parentId: null, fontSize: 24, textAlign: 'center' },
        { id: 'block-2', name: 'Pitch', type: 'text', x: 50, y: 100, width: 400, height: 100, content: { text: 'Bonjour [Nom Contact], je suis [Nom Agent] de [Société].\nComment allez-vous aujourd\'hui ?' }, displayCondition: null, parentId: null },
        { id: 'block-3', name: 'Nom Contact', type: 'input', x: 50, y: 220, width: 300, height: 70, content: { label: 'Nom du contact', placeholder: 'Saisir le nom ici' }, displayCondition: null, parentId: null },
    ]
};

const savedScripts: SavedScript[] = [
    {
        id: 'script-1',
        name: 'Script Vente Trimestre 4',
        pages: [firstPage],
        startPageId: firstPage.id,
        backgroundColor: '#f1f5f9'
    },
    {
        id: 'script-2',
        name: 'Script Support Technique',
        pages: [firstPage],
        startPageId: firstPage.id,
        backgroundColor: '#f0fdf4'
    }
];

const startNode: IvrNode = { id: `node-start-1659540000000`, type: 'start', name: 'Début', x: 50, y: 150, content: {} };
const savedIvrFlows: IvrFlow[] = [
    {
        id: 'ivr-1',
        name: 'SVI Principal',
        nodes: [startNode],
        connections: []
    }
];

const contacts: Contact[] = [
    { id: 'contact-1', firstName: 'John', lastName: 'Doe', phoneNumber: '0611223344', postalCode: '75001', status: 'pending' },
    { id: 'contact-2', firstName: 'Jane', lastName: 'Smith', phoneNumber: '0655667788', postalCode: '13001', status: 'pending' },
    { id: 'contact-3', firstName: 'Peter', lastName: 'Jones', phoneNumber: '0699887766', postalCode: '69001', status: 'called' },
    // Contacts for callbacks
    { id: 'contact-cb-1', firstName: 'Marie', lastName: 'Dubois', phoneNumber: '0612345678', postalCode: '75010', status: 'called' },
    { id: 'contact-cb-2', firstName: 'Jean', lastName: 'Martin', phoneNumber: '0687654321', postalCode: '75011', status: 'called' },
    { id: 'contact-cb-3', firstName: 'Lucie', lastName: 'Petit', phoneNumber: '0701020304', postalCode: '69002', status: 'called' },
    { id: 'contact-cb-4', firstName: 'Paul', lastName: 'Bernard', phoneNumber: '0655555555', postalCode: '13002', status: 'called' },
];

const campaigns: Campaign[] = [
    {
        id: 'campaign-1',
        name: 'Ventes Trimestre 4',
        description: 'Campagne de prospection pour les ventes de fin d\'année.',
        scriptId: 'script-1',
        callerId: '0188776655',
        isActive: true,
        assignedUserIds: ['user-agent-1', 'user-agent-2'],
        qualificationGroupId: 'qg-1',
        contacts: [contacts[0], contacts[2], contacts[3], contacts[5]],
        dialingMode: 'PROGRESSIVE',
        priority: 10,
        timezone: 'Europe/Paris',
        callingDays: [1, 2, 3, 4, 5],
        callingStartTime: '09:00',
        callingEndTime: '20:00',
        maxAbandonRate: 3,
        paceFactor: 1.2,
        minAgentsBeforeStart: 1,
        retryAttempts: 3,
        retryIntervals: [30, 60, 120],
        retryOnStatus: ['qual-neg-2'],
        amdEnabled: true,
        amdConfidence: 80,
        voicemailAction: 'HANGUP',
        recordingEnabled: true,
        recordingBeep: true,
        maxRingDuration: 25,
        wrapUpTime: 10,
        maxCallDuration: 3600,
        quotaRules: [
            { id: 'q-1', contactField: 'postalCode', operator: 'starts_with', value: '75', limit: 10, currentCount: 3 }
        ],
        filterRules: [
            { id: 'f-1', type: 'exclude', contactField: 'phoneNumber', operator: 'starts_with', value: '07' }
        ],
    },
    {
        id: 'campaign-2',
        name: 'Relance Factures Impayées',
        description: 'Contacter les clients avec des factures en retard.',
        scriptId: null,
        callerId: '0188776650',
        isActive: true,
        assignedUserIds: ['user-agent-1', 'user-agent-3'],
        qualificationGroupId: 'qg-2',
        contacts: [
             { id: 'contact-4', firstName: 'Eva', lastName: 'Green', phoneNumber: '0711223344', postalCode: '75002', status: 'pending' },
             contacts[1], contacts[4], contacts[6]
        ],
        dialingMode: 'MANUAL',
        priority: 5,
        timezone: 'Europe/Paris',
        callingDays: [1, 2, 3, 4, 5],
        callingStartTime: '10:00',
        callingEndTime: '18:00',
        maxAbandonRate: 3,
        paceFactor: 1.0,
        minAgentsBeforeStart: 1,
        retryAttempts: 2,
        retryIntervals: [1440],
        retryOnStatus: [],
        amdEnabled: false,
        amdConfidence: 80,
        voicemailAction: 'HANGUP',
        recordingEnabled: true,
        recordingBeep: false,
        maxRingDuration: 30,
        wrapUpTime: 25,
        maxCallDuration: 600,
        quotaRules: [],
        filterRules: [],
    }
];

const qualifications: Qualification[] = [
    // Standard qualifications as requested by the user, non-modifiable.
    { id: 'std-90', code: '90', description: 'Occupé', type: 'neutral', groupId: null, isStandard: true },
    { id: 'std-91', code: '91', description: 'Faux numéro', type: 'negative', groupId: null, isStandard: true },
    { id: 'std-92', code: '92', description: 'Absent', type: 'neutral', groupId: null, isStandard: true },
    { id: 'std-93', code: '93', description: 'Repondeur', type: 'neutral', groupId: null, isStandard: true },
    { id: 'std-94', code: '94', description: 'Rappel personnel', type: 'neutral', groupId: null, isStandard: true },
    { id: 'std-95', code: '95', description: 'Relance', type: 'neutral', groupId: null, isStandard: true },
    { id: 'std-96', code: '96', description: 'Indisponible', type: 'neutral', groupId: null, isStandard: true },
    { id: 'std-97', code: '97', description: 'Transfert', type: 'neutral', groupId: null, isStandard: true },

    // Custom qualifications for demonstration
    { id: 'qual-pos-1', code: '100', description: 'Vente réalisée', type: 'positive', groupId: 'qg-1', isStandard: false },
    { id: 'qual-pos-2', code: '101', description: 'Rendez-vous pris', type: 'positive', groupId: 'qg-1', isStandard: false },
    
    // New hierarchical qualifications, initially assigned to group 'qg-1' to demonstrate the feature
    { id: 'qual-parent-1', code: '200', description: 'Contact Argumenté', type: 'neutral', groupId: 'qg-1', isStandard: false, parentId: null },
    { id: 'qual-neg-1', code: '102', description: 'Pas intéressé - Prix', type: 'negative', groupId: 'qg-1', isStandard: false, parentId: 'qual-parent-1' },
    { id: 'qual-neg-2', code: '201', description: 'Déjà équipé', type: 'negative', groupId: 'qg-1', isStandard: false, parentId: 'qual-parent-1' },
    
    // This one is available for assignment
    { id: 'qual-rec-1', code: '103', description: 'Paiement effectué', type: 'positive', groupId: null, isStandard: false },
];


const qualificationGroups: QualificationGroup[] = [
    { id: 'qg-1', name: 'Ventes' },
    { id: 'qg-2', name: 'Recouvrement' }
];

const trunks: Trunk[] = [
    // Fix: Added missing properties to match the Trunk type definition.
    { id: 'trunk-1', name: 'Opérateur Principal', domain: 'sip.provider.com', login: 'user12345', authType: 'register', dialPattern: '_0.', inboundContext: 'from-trunk' },
    // Fix: Added missing properties to match the Trunk type definition.
    { id: 'trunk-2', name: 'Opérateur Secondaire', domain: 'sip.another.fr', login: 'user67890', authType: 'register', dialPattern: '_00.', inboundContext: 'from-trunk' }
];

const dids: Did[] = [
    { id: 'did-1', number: '0188776655', description: 'Numéro principal Ventes', trunkId: 'trunk-1', ivrFlowId: 'ivr-1' }
];

const backupLogs: BackupLog[] = [
    { id: 'log-1', timestamp: new Date(Date.now() - 86400000).toISOString(), status: 'success', fileName: `backup-auto-${new Date(Date.now() - 86400000).toISOString().split('T')[0]}.zip` },
    { id: 'log-2', timestamp: new Date(Date.now() - 172800000).toISOString(), status: 'success', fileName: `backup-auto-${new Date(Date.now() - 172800000).toISOString().split('T')[0]}.zip` }
];

const backupSchedule: BackupSchedule = {
    frequency: 'daily',
    time: '02:00'
};

const systemLogs: SystemLog[] = [
    { id: 'slog-1', timestamp: new Date().toISOString(), level: 'INFO', service: 'asterisk', message: 'SIP registration successful for trunk-1' },
    { id: 'slog-2', timestamp: new Date(Date.now() - 5000).toISOString(), level: 'WARNING', service: 'fast-agi', message: 'High latency detected on API endpoint (152ms)' },
    { id: 'slog-3', timestamp: new Date(Date.now() - 10000).toISOString(), level: 'INFO', service: 'application', message: 'User Alice Admin logged in' },
    { id: 'slog-4', timestamp: new Date(Date.now() - 60000).toISOString(), level: 'ERROR', service: 'database', message: 'Connection to pool timed out' },
];

const versionInfo: VersionInfo = {
    application: '2.1.0',
    asterisk: '18.5.1',
    database: 'PostgreSQL 14.2',
    'fast-agi': '1.0.3'
};

const connectivityServices: ConnectivityService[] = [
    { id: 'cs-1', name: 'Base de données', target: 'db.internal:5432' },
    { id: 'cs-2', name: 'API CRM', target: 'api.crm.com:443' },
    { id: 'cs-3', name: 'Serveur de messagerie', target: 'smtp.provider.net:587' }
];

const callHistory: CallHistoryRecord[] = [
    { id: 'callhist-1', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'outbound', agentId: 'user-agent-1', campaignId: 'campaign-1', callerNumber: '0611223344', duration: 185, qualificationId: 'qual-pos-2' },
    { id: 'callhist-2', timestamp: new Date(Date.now() - 7200000).toISOString(), direction: 'outbound', agentId: 'user-agent-2', campaignId: 'campaign-1', callerNumber: '0655667788', duration: 92, qualificationId: 'qual-neg-1' },
    { id: 'callhist-3', timestamp: new Date(Date.now() - 86400000).toISOString(), direction: 'outbound', agentId: 'user-agent-1', campaignId: 'campaign-1', callerNumber: '0699887766', duration: 320, qualificationId: 'qual-pos-1' },
    { id: 'callhist-4', timestamp: new Date(Date.now() - 1200000).toISOString(), direction: 'inbound', agentId: 'user-agent-2', campaignId: null, callerNumber: '0788990011', duration: 240, qualificationId: 'qual-pos-1' },
    { id: 'callhist-5', timestamp: new Date(Date.now() - 90000000).toISOString(), direction: 'inbound', agentId: 'user-agent-3', campaignId: null, callerNumber: '0712345678', duration: 65, qualificationId: 'std-91' },
];

const agentSessions: AgentSession[] = [
     { id: 'session-1', agentId: 'user-agent-1', loginTime: new Date(Date.now() - 28800000).toISOString(), logoutTime: new Date(Date.now() - 14400000).toISOString() },
     { id: 'session-2', agentId: 'user-agent-2', loginTime: new Date(Date.now() - 28900000).toISOString(), logoutTime: new Date(Date.now() - 14500000).toISOString() },
     { id: 'session-3', agentId: 'user-agent-1', loginTime: new Date(Date.now() - 86400000 - 28800000).toISOString(), logoutTime: new Date(Date.now() - 86400000 - 14400000).toISOString() },
];

const audioFiles: AudioFile[] = [
    {
        id: 'audio-1',
        name: 'Message d\'accueil principal',
        fileName: 'accueil_principal_v2.mp3',
        duration: 15, // seconds
        size: 245760, // bytes
        uploadDate: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
        id: 'audio-2',
        name: 'Musique d\'attente - Jazz',
        fileName: 'hold_music_jazz_loop.wav',
        duration: 180,
        size: 3145728,
        uploadDate: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
    {
        id: 'audio-3',
        name: 'Annonce fermeture exceptionnelle',
        fileName: 'fermeture_noel.mp3',
        duration: 22,
        size: 360448,
        uploadDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    }
];

const activityTypes: ActivityType[] = [
    { id: 'act-1', name: 'Appels - Ventes T4', color: '#4f46e5' },
    { id: 'act-2', name: 'Pause Déjeuner', color: '#64748b' },
    { id: 'act-3', name: 'Formation', color: '#f59e0b' },
    { id: 'act-4', name: 'Réunion d\'équipe', color: '#8b5cf6' },
];

const getRelativeDate = (dayOffset: number, hour: number, minute: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
}

const planningEvents: PlanningEvent[] = [
    // Alice's day
    { id: 'plan-1', agentId: 'user-agent-1', activityId: 'act-1', startDate: getRelativeDate(0, 9), endDate: getRelativeDate(0, 12) },
    { id: 'plan-2', agentId: 'user-agent-1', activityId: 'act-2', startDate: getRelativeDate(0, 12), endDate: getRelativeDate(0, 13) },
    { id: 'plan-3', agentId: 'user-agent-1', activityId: 'act-1', startDate: getRelativeDate(0, 13), endDate: getRelativeDate(0, 17) },
    // Bob's day
    { id: 'plan-4', agentId: 'user-agent-2', activityId: 'act-1', startDate: getRelativeDate(0, 9), endDate: getRelativeDate(0, 11) },
    { id: 'plan-5', agentId: 'user-agent-2', activityId: 'act-3', startDate: getRelativeDate(0, 11), endDate: getRelativeDate(0, 12, 30) },
    { id: 'plan-6', agentId: 'user-agent-2', activityId: 'act-2', startDate: getRelativeDate(0, 12, 30), endDate: getRelativeDate(0, 13, 30) },
    { id: 'plan-7', agentId: 'user-agent-2', activityId: 'act-1', startDate: getRelativeDate(0, 13, 30), endDate: getRelativeDate(0, 17) },
];

const personalCallbacks: PersonalCallback[] = [
    {
        id: 'cb-1',
        agentId: 'user-agent-1',
        contactId: 'contact-cb-1',
        campaignId: 'campaign-1',
        contactName: 'Marie Dubois',
        contactNumber: '0612345678',
        scheduledTime: getRelativeDate(0, 14, 30),
        notes: 'Intéressée par le produit B, rappeler avec une offre.'
    },
    {
        id: 'cb-2',
        agentId: 'user-agent-1',
        contactId: 'contact-cb-2',
        campaignId: 'campaign-2',
        contactName: 'Jean Martin',
        contactNumber: '0687654321',
        scheduledTime: getRelativeDate(0, 17, 0),
        notes: 'A demandé à être rappelé en fin de journée.'
    },
    {
        id: 'cb-3',
        agentId: 'user-agent-2', // For Bob
        contactId: 'contact-cb-3',
        campaignId: 'campaign-1',
        contactName: 'Lucie Petit',
        contactNumber: '0701020304',
        scheduledTime: getRelativeDate(0, 11, 15),
        notes: 'Rappel pour confirmation de RDV.'
    },
    {
        id: 'cb-4',
        agentId: 'user-agent-1',
        contactId: 'contact-cb-4',
        campaignId: 'campaign-2',
        contactName: 'Paul Bernard',
        contactNumber: '0655555555',
        scheduledTime: getRelativeDate(1, 10, 0),
        notes: 'Rappel pour le lendemain.'
    }
];


export const mockData = {
    sites,
    users,
    userGroups,
    savedScripts,
    savedIvrFlows,
    campaigns,
    qualifications,
    qualificationGroups,
    trunks,
    dids,
    backupLogs,
    backupSchedule,
    systemLogs,
    versionInfo,
    connectivityServices,
    callHistory,
    agentSessions,
    audioFiles,
    activityTypes,
    planningEvents,
    personalCallbacks
};