import React, { useState, useMemo, useEffect } from 'react';
import type { User, Feature, FeatureId, ModuleVisibility, Campaign, UserGroup, SavedScript, IvrFlow, Qualification, QualificationGroup, Did, Trunk, Site, AudioFile, PlanningEvent, SystemConnectionSettings, PersonalCallback, Contact, BackupSchedule, BackupLog, SystemLog, VersionInfo, ConnectivityService, ActivityType, AgentSession, CallHistoryRecord } from './types.ts';
import { features } from './data/features.ts';
import { mockData } from './data/mockData.ts'; // Kept for simulated data not yet in DB
import Sidebar from './components/Sidebar.tsx';
import FeatureDetail from './components/FeatureDetail.tsx';
import LoginScreen from './components/LoginScreen.tsx';
import Header from './components/Header.tsx';
import MonitoringDashboard from './components/MonitoringDashboard.tsx';
import AgentView from './components/AgentView.tsx';


const App: React.FC = () => {
    // --- STATE MANAGEMENT ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // All application data, initialized empty, to be filled from API
    const [users, setUsers] = useState<User[]>([]);
    const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [savedScripts, setSavedScripts] = useState<SavedScript[]>([]);
    const [ivrFlows, setIvrFlows] = useState<IvrFlow[]>([]);
    const [qualifications, setQualifications] = useState<Qualification[]>([]);
    const [qualificationGroups, setQualificationGroups] = useState<QualificationGroup[]>([]);
    const [dids, setDids] = useState<Did[]>([]);
    const [trunks, setTrunks] = useState<Trunk[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
    const [planningEvents, setPlanningEvents] = useState<PlanningEvent[]>([]);
    const [personalCallbacks, setPersonalCallbacks] = useState<PersonalCallback[]>([]);
    const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
    
    // Non-persistent or simulated data
    const [systemConnectionSettings, setSystemConnectionSettings] = useState<SystemConnectionSettings>(mockData.systemConnectionSettings);
    const [backupSchedule, setBackupSchedule] = useState<BackupSchedule>(mockData.backupSchedule);
    const [backupLogs, setBackupLogs] = useState<BackupLog[]>(mockData.backupLogs);
    const [moduleVisibility, setModuleVisibility] = useState<ModuleVisibility>({ categories: {}, features: {} });

    const [activeView, setActiveView] = useState<'app' | 'monitoring'>('app');
    const [activeFeatureId, setActiveFeatureId] = useState<FeatureId | null>('users');
    
    // --- DATA FETCHING ---
    const fetchApplicationData = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/application-data');
            if (!response.ok) throw new Error('Failed to fetch application data');
            const data = await response.json();

            setUsers(data.users || []);
            setUserGroups(data.userGroups || []);
            setCampaigns(data.campaigns || []);
            setSavedScripts(data.savedScripts || []);
            setIvrFlows(data.savedIvrFlows || []);
            setQualifications(data.qualifications || []);
            setQualificationGroups(data.qualificationGroups || []);
            setDids(data.dids || []);
            setTrunks(data.trunks || []);
            setSites(data.sites || []);
            setAudioFiles(data.audioFiles || []);
            setPlanningEvents(data.planningEvents || []);
            setPersonalCallbacks(data.personalCallbacks || []);
            setActivityTypes(data.activityTypes || []);

        } catch (error) {
            console.error("Error fetching data:", error);
            // Optionally, set an error state to show in the UI
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        if (currentUser) {
            fetchApplicationData();
        } else {
            // Clear data on logout
            setUsers([]);
            setUserGroups([]);
            setCampaigns([]);
            setSavedScripts([]);
            setIvrFlows([]);
            setQualifications([]);
            setQualificationGroups([]);
            setDids([]);
            setTrunks([]);
            setSites([]);
            setAudioFiles([]);
            setPlanningEvents([]);
            setPersonalCallbacks([]);
            setActivityTypes([]);
            setIsLoading(false);
        }
    }, [currentUser]);

    // --- COMPUTED VALUES ---
    const activeFeature = useMemo(() => features.find(f => f.id === activeFeatureId), [activeFeatureId]);

    // --- EVENT HANDLERS ---
    const handleLoginSuccess = (user: User) => setCurrentUser(user);
    
    const handleLogout = () => {
        // Secure cleanup: Clear any sensitive data stored locally in the browser.
        localStorage.clear();
        sessionStorage.clear();
        console.log("Local storage and session storage cleared for security.");
        
        // Reset the application state to return to the login screen.
        setCurrentUser(null);
    };

    const handleSelectFeature = (id: FeatureId) => setActiveFeatureId(id);

    // --- DATA MUTATION HANDLERS (API CALLS) ---
    
    // Helper for API calls
    const apiCall = async (url: string, method: string, body?: any) => {
        const options: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'API request failed');
        }
        if (response.status !== 204) {
            return response.json();
        }
        return null;
    };

    // Users
    const handleSaveUser = async (user: User, groupIds: string[]) => {
        const isNew = !users.some(u => u.id === user.id);
        const url = isNew ? '/api/users' : `/api/users/${user.id}`;
        await apiCall(url, isNew ? 'POST' : 'PUT', { user, groupIds });
        await fetchApplicationData();
    };
    const handleDeleteUser = async (userId: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) {
            await apiCall(`/api/users/${userId}`, 'DELETE');
            await fetchApplicationData();
        }
    };
    const handleGenerateUsers = async (newUsers: User[]) => {
        await Promise.all(newUsers.map(user => apiCall('/api/users', 'POST', { user, groupIds: [] })));
        await fetchApplicationData();
    };

    // User Groups
    const handleSaveUserGroup = async (group: UserGroup) => {
        const isNew = !userGroups.some(g => g.id === group.id);
        const url = isNew ? '/api/groups' : `/api/groups/${group.id}`;
        await apiCall(url, isNew ? 'POST' : 'PUT', group);
        await fetchApplicationData();
    };
    const handleDeleteUserGroup = async (groupId: string) => {
        await apiCall(`/api/groups/${groupId}`, 'DELETE');
        await fetchApplicationData();
    };

    // Campaigns
    const handleSaveCampaign = async (campaign: Campaign) => {
        const isNew = !campaigns.some(c => c.id === campaign.id);
        const url = isNew ? '/api/campaigns' : `/api/campaigns/${campaign.id}`;
        await apiCall(url, isNew ? 'POST' : 'PUT', campaign);
        await fetchApplicationData();
    };
    const handleDeleteCampaign = async (campaignId: string) => {
        await apiCall(`/api/campaigns/${campaignId}`, 'DELETE');
        await fetchApplicationData();
    };
    const handleImportContacts = async (campaignId: string, contacts: Contact[]) => {
        await apiCall(`/api/campaigns/${campaignId}/contacts`, 'POST', { contacts });
        await fetchApplicationData();
    };
    
    // Scripts
    const handleSaveOrUpdateScript = async (script: SavedScript) => {
        const isNew = !savedScripts.some(s => s.id === script.id);
        const url = isNew ? '/api/scripts' : `/api/scripts/${script.id}`;
        await apiCall(url, isNew ? 'POST' : 'PUT', script);
        await fetchApplicationData();
    };
    const handleDeleteScript = async (scriptId: string) => {
        await apiCall(`/api/scripts/${scriptId}`, 'DELETE');
        await fetchApplicationData();
    };
    const handleDuplicateScript = async (scriptId: string) => {
        await apiCall(`/api/scripts/${scriptId}/duplicate`, 'POST');
        await fetchApplicationData();
    };
    
    // IVR Flows
    const handleSaveOrUpdateIvrFlow = async (flow: IvrFlow) => {
        const isNew = !ivrFlows.some(f => f.id === flow.id);
        const url = isNew ? '/api/ivr-flows' : `/api/ivr-flows/${flow.id}`;
        await apiCall(url, isNew ? 'POST' : 'PUT', flow);
        await fetchApplicationData();
    };
    const handleDeleteIvrFlow = async (flowId: string) => {
        await apiCall(`/api/ivr-flows/${flowId}`, 'DELETE');
        await fetchApplicationData();
    };
    const handleDuplicateIvrFlow = async (flowId: string) => {
        await apiCall(`/api/ivr-flows/${flowId}/duplicate`, 'POST');
        await fetchApplicationData();
    };

    // Qualifications
    const handleSaveQualification = async (qual: Qualification) => {
        const isNew = !qualifications.some(q => q.id === qual.id);
        const url = isNew ? '/api/qualifications' : `/api/qualifications/${qual.id}`;
        await apiCall(url, isNew ? 'POST' : 'PUT', qual);
        await fetchApplicationData();
    };
    const handleDeleteQualification = async (qualId: string) => {
         if (window.confirm("Êtes-vous sûr de vouloir supprimer cette qualification ? Elle sera retirée de tous les groupes.")) {
            await apiCall(`/api/qualifications/${qualId}`, 'DELETE');
            await fetchApplicationData();
        }
    };

    // Qualification Groups
    const handleSaveQualificationGroup = async (group: QualificationGroup, assignedQualIds: string[]) => {
        const isNew = !qualificationGroups.some(qg => qg.id === group.id);
        const url = isNew ? '/api/qualification-groups' : `/api/qualification-groups/${group.id}`;
        await apiCall(url, isNew ? 'POST' : 'PUT', { group, assignedQualIds });
        await fetchApplicationData();
    };
    const handleDeleteQualificationGroup = async (groupId: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce groupe ? Les qualifications ne seront pas supprimées mais désassignées.")) {
            await apiCall(`/api/qualification-groups/${groupId}`, 'DELETE');
            await fetchApplicationData();
        }
    };
    
    // Generic handlers for simple CRUD (can be expanded)
    const createCrudHandlers = <T extends { id: string }>(
        pluralName: string, 
        data: T[], 
        setData: React.Dispatch<React.SetStateAction<T[]>>
    ) => ({
        save: async (item: T) => {
            const isNew = !data.some(d => d.id === item.id);
            const url = isNew ? `/api/${pluralName}` : `/api/${pluralName}/${item.id}`;
            await apiCall(url, isNew ? 'POST' : 'PUT', item);
            await fetchApplicationData();
        },
        delete: async (id: string) => {
            await apiCall(`/api/${pluralName}/${id}`, 'DELETE');
            await fetchApplicationData();
        }
    });
    
    const didHandlers = createCrudHandlers('dids', dids, setDids);
    const trunkHandlers = createCrudHandlers('trunks', trunks, setTrunks);
    const siteHandlers = createCrudHandlers('sites', sites, setSites);
    const audioHandlers = createCrudHandlers('audio-files', audioFiles, setAudioFiles);
    const planningEventHandlers = createCrudHandlers('planning-events', planningEvents, setPlanningEvents);

    const handleRunBackup = () => {
         setBackupLogs(prev => [
            { id: `log-${Date.now()}`, timestamp: new Date().toISOString(), status: 'success', fileName: `backup-manual-${new Date().toISOString().split('T')[0]}.zip` },
            ...prev
        ]);
    };

    // --- RENDER LOGIC ---
    if (!currentUser) {
        return <LoginScreen users={users} onLoginSuccess={handleLoginSuccess} />;
    }

    if (currentUser.role === 'Agent') {
        return <AgentView 
            agent={currentUser} 
            campaigns={campaigns}
            savedScripts={savedScripts}
            sites={sites}
            personalCallbacks={personalCallbacks}
            qualifications={qualifications}
            qualificationGroups={qualificationGroups}
            onLogout={handleLogout}
        />;
    }
    
    if (isLoading) {
        return <div className="h-screen w-screen flex items-center justify-center">Loading application data...</div>;
    }
    
    const featureComponentProps: any = {
        feature: activeFeature,
        currentUser,
        users, onSaveUser: handleSaveUser, onDeleteUser: handleDeleteUser, onGenerateUsers: handleGenerateUsers, onImportUsers: handleGenerateUsers,
        userGroups, onSaveUserGroup: handleSaveUserGroup, onDeleteUserGroup: handleDeleteUserGroup,
        campaigns, onSaveCampaign: handleSaveCampaign, onDeleteCampaign: handleDeleteCampaign, onImportContacts: handleImportContacts,
        savedScripts, onSaveOrUpdateScript: handleSaveOrUpdateScript, onDeleteScript: handleDeleteScript, onDuplicateScript: handleDuplicateScript,
        ivrFlows, onSaveOrUpdateIvrFlow: handleSaveOrUpdateIvrFlow, onDeleteIvrFlow: handleDeleteIvrFlow, onDuplicateIvrFlow: handleDuplicateIvrFlow,
        qualifications, onSaveQualification: handleSaveQualification, onDeleteQualification: handleDeleteQualification,
        qualificationGroups, onSaveQualificationGroup: handleSaveQualificationGroup, onDeleteQualificationGroup: handleDeleteQualificationGroup,
        dids, onSaveDid: didHandlers.save, onDeleteDid: didHandlers.delete,
        trunks, onSaveTrunk: trunkHandlers.save, onDeleteTrunk: trunkHandlers.delete,
        sites, onSaveSite: siteHandlers.save, onDeleteSite: siteHandlers.delete,
        audioFiles, onSaveAudioFile: audioHandlers.save, onDeleteAudioFile: audioHandlers.delete,
        planningEvents, onSavePlanningEvent: planningEventHandlers.save, onDeletePlanningEvent: planningEventHandlers.delete,
        personalCallbacks,
        systemConnectionSettings, onSaveSystemConnectionSettings: setSystemConnectionSettings,
        features, moduleVisibility, onSaveVisibilitySettings: setModuleVisibility,
        callHistory: mockData.callHistory as CallHistoryRecord[],
        agentSessions: mockData.agentSessions as AgentSession[],
        systemLogs: mockData.systemLogs as SystemLog[],
        versionInfo: mockData.versionInfo as VersionInfo,
        connectivityServices: mockData.connectivityServices as ConnectivityService[],
        backupLogs, backupSchedule, onSaveBackupSchedule: setBackupSchedule, onRunBackup: handleRunBackup,
        activityTypes,
    };

    const ActiveComponent = activeFeature?.component;
    
    return (
        <div className="h-screen w-screen flex bg-slate-100 font-sans">
            <Sidebar
                features={features}
                activeFeatureId={activeFeatureId}
                onSelectFeature={handleSelectFeature}
                currentUser={currentUser}
                onLogout={handleLogout}
                moduleVisibility={moduleVisibility}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                {currentUser.role === 'SuperAdmin' && <Header activeView={activeView} onViewChange={setActiveView} />}
                <main className="flex-1 overflow-y-auto p-8">
                    {activeView === 'monitoring' && currentUser.role === 'SuperAdmin' ? (
                        <MonitoringDashboard
                            systemLogs={mockData.systemLogs}
                            versionInfo={mockData.versionInfo}
                            connectivityServices={mockData.connectivityServices}
                        />
                    ) : (
                       ActiveComponent ? <ActiveComponent {...featureComponentProps} /> : <FeatureDetail feature={activeFeature || null} />
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;