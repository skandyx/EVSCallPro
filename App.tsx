import React, { useState, useMemo } from 'react';
// Fix: Importing all necessary types for state management.
import type { User, Feature, FeatureId, ModuleVisibility, Campaign, UserGroup, SavedScript, IvrFlow, Qualification, QualificationGroup, Did, Trunk, Site, AudioFile, PlanningEvent, SystemConnectionSettings, PersonalCallback, Contact, BackupSchedule, BackupLog, SystemLog, VersionInfo, ConnectivityService, ActivityType, AgentSession, CallHistoryRecord } from './types.ts';
import { features } from './data/features.ts';
import { mockData } from './data/mockData.ts';
import Sidebar from './components/Sidebar.tsx';
import FeatureDetail from './components/FeatureDetail.tsx';
import LoginScreen from './components/LoginScreen.tsx';
import Header from './components/Header.tsx';
import MonitoringDashboard from './components/MonitoringDashboard.tsx';
import AgentView from './components/AgentView.tsx';

// Fix: The entire App component was missing. This is the root component that orchestrates the entire application.
const App: React.FC = () => {
    // --- STATE MANAGEMENT ---
    // Simulating a backend with useState
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>(mockData.users);
    const [userGroups, setUserGroups] = useState<UserGroup[]>(mockData.userGroups);
    const [campaigns, setCampaigns] = useState<Campaign[]>(mockData.campaigns);
    const [savedScripts, setSavedScripts] = useState<SavedScript[]>(mockData.savedScripts);
    const [ivrFlows, setIvrFlows] = useState<IvrFlow[]>(mockData.savedIvrFlows);
    const [qualifications, setQualifications] = useState<Qualification[]>(mockData.qualifications);
    const [qualificationGroups, setQualificationGroups] = useState<QualificationGroup[]>(mockData.qualificationGroups);
    const [dids, setDids] = useState<Did[]>(mockData.dids);
    const [trunks, setTrunks] = useState<Trunk[]>(mockData.trunks);
    const [sites, setSites] = useState<Site[]>(mockData.sites);
    const [audioFiles, setAudioFiles] = useState<AudioFile[]>(mockData.audioFiles);
    const [planningEvents, setPlanningEvents] = useState<PlanningEvent[]>(mockData.planningEvents);
    const [personalCallbacks, setPersonalCallbacks] = useState<PersonalCallback[]>(mockData.personalCallbacks);
    const [systemConnectionSettings, setSystemConnectionSettings] = useState<SystemConnectionSettings>(mockData.systemConnectionSettings);
    const [backupSchedule, setBackupSchedule] = useState<BackupSchedule>(mockData.backupSchedule);
    const [backupLogs, setBackupLogs] = useState<BackupLog[]>(mockData.backupLogs);


    const [activeView, setActiveView] = useState<'app' | 'monitoring'>('app');
    const [activeFeatureId, setActiveFeatureId] = useState<FeatureId | null>('users');
    
    // --- Module Visibility (SuperAdmin feature) ---
    const [moduleVisibility, setModuleVisibility] = useState<ModuleVisibility>({
        categories: {},
        features: {},
    });

    // --- COMPUTED VALUES ---
    const activeFeature = useMemo(
        () => features.find(f => f.id === activeFeatureId),
        [activeFeatureId]
    );

    // --- EVENT HANDLERS ---
    const handleLoginSuccess = (user: User) => {
        setCurrentUser(user);
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setActiveFeatureId(null);
    };

    const handleSelectFeature = (id: FeatureId) => {
        setActiveFeatureId(id);
    };

    // --- DATA MUTATION HANDLERS (CRUD SIMULATION) ---
    // These functions simulate updating a backend database.
    
    // Users
    const handleSaveUser = (user: User, groupIds: string[]) => {
        setUsers(prev => {
            const index = prev.findIndex(u => u.id === user.id);
            if (index > -1) {
                const newUsers = [...prev];
                newUsers[index] = user;
                return newUsers;
            }
            return [...prev, user];
        });
        setUserGroups(prev => {
            const newGroups = JSON.parse(JSON.stringify(prev));
            // Remove user from all groups first
            newGroups.forEach((g: UserGroup) => {
                g.memberIds = g.memberIds.filter(id => id !== user.id);
            });
            // Add user to selected groups
            groupIds.forEach(groupId => {
                const group = newGroups.find((g: UserGroup) => g.id === groupId);
                if (group) {
                    group.memberIds.push(user.id);
                }
            });
            return newGroups;
        });
    };
    const handleDeleteUser = (userId: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) {
            setUsers(prev => prev.filter(u => u.id !== userId));
            setUserGroups(prev => prev.map(g => ({...g, memberIds: g.memberIds.filter(id => id !== userId)})));
        }
    };
    const handleGenerateUsers = (newUsers: User[]) => {
        setUsers(prev => [...prev, ...newUsers]);
    };

    // User Groups
    const handleSaveUserGroup = (group: UserGroup) => {
        setUserGroups(prev => {
            const index = prev.findIndex(g => g.id === group.id);
            if (index > -1) {
                const newGroups = [...prev];
                newGroups[index] = group;
                return newGroups;
            }
            return [...prev, group];
        });
    };
    const handleDeleteUserGroup = (groupId: string) => {
        setUserGroups(prev => prev.filter(g => g.id !== groupId));
    };

    // Campaigns
    const handleSaveCampaign = (campaign: Campaign) => {
        setCampaigns(prev => {
            const index = prev.findIndex(c => c.id === campaign.id);
            if (index > -1) {
                const newCampaigns = [...prev];
                newCampaigns[index] = campaign;
                return newCampaigns;
            }
            return [...prev, campaign];
        });
    };
    const handleDeleteCampaign = (campaignId: string) => {
        setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    };
    const handleImportContacts = (campaignId: string, contacts: Contact[]) => {
        setCampaigns(prev => prev.map(c => {
            if (c.id === campaignId) {
                return { ...c, contacts: [...c.contacts, ...contacts] };
            }
            return c;
        }));
    };
    
    // Scripts
    const handleSaveOrUpdateScript = (script: SavedScript) => {
        setSavedScripts(prev => {
            const index = prev.findIndex(s => s.id === script.id);
            if (index > -1) {
                const newScripts = [...prev];
                newScripts[index] = script;
                return newScripts;
            }
            return [...prev, script];
        });
    };
    const handleDeleteScript = (scriptId: string) => {
        setSavedScripts(prev => prev.filter(s => s.id !== scriptId));
    };
    const handleDuplicateScript = (scriptId: string) => {
        const scriptToDuplicate = savedScripts.find(s => s.id === scriptId);
        if (scriptToDuplicate) {
            const newScript = JSON.parse(JSON.stringify(scriptToDuplicate));
            newScript.id = `script-${Date.now()}`;
            newScript.name = `${scriptToDuplicate.name} (Copie)`;
            setSavedScripts(prev => [...prev, newScript]);
        }
    };
    
    // IVR Flows
    const handleSaveOrUpdateIvrFlow = (flow: IvrFlow) => {
        setIvrFlows(prev => {
            const index = prev.findIndex(f => f.id === flow.id);
            if (index > -1) {
                const newFlows = [...prev];
                newFlows[index] = flow;
                return newFlows;
            }
            return [...prev, flow];
        });
    };
    const handleDeleteIvrFlow = (flowId: string) => {
        setIvrFlows(prev => prev.filter(f => f.id !== flowId));
    };
     const handleDuplicateIvrFlow = (flowId: string) => {
        const flowToDuplicate = ivrFlows.find(f => f.id === flowId);
        if (flowToDuplicate) {
            const newFlow = JSON.parse(JSON.stringify(flowToDuplicate));
            newFlow.id = `ivr-flow-${Date.now()}`;
            newFlow.name = `${flowToDuplicate.name} (Copie)`;
            setIvrFlows(prev => [...prev, newFlow]);
        }
    };

    // Qualifications
    const handleSaveQualification = (qual: Qualification) => {
        setQualifications(prev => {
            const index = prev.findIndex(q => q.id === qual.id);
            if (index > -1) {
                const newQuals = [...prev];
                newQuals[index] = qual;
                return newQuals;
            }
            return [...prev, qual];
        });
    };
    const handleDeleteQualification = (qualId: string) => {
         if (window.confirm("Êtes-vous sûr de vouloir supprimer cette qualification ? Elle sera retirée de tous les groupes.")) {
            setQualifications(prev => prev.filter(q => q.id !== qualId));
        }
    };

    // Qualification Groups
    const handleSaveQualificationGroup = (group: QualificationGroup, assignedQualIds: string[]) => {
        setQualificationGroups(prev => {
            const index = prev.findIndex(g => g.id === group.id);
            if (index > -1) {
                const newGroups = [...prev];
                newGroups[index] = group;
                return newGroups;
            }
            return [...prev, group];
        });
        setQualifications(prev => {
            return prev.map(q => {
                if (assignedQualIds.includes(q.id)) {
                    return { ...q, groupId: group.id };
                }
                if (q.groupId === group.id) {
                    return { ...q, groupId: null };
                }
                return q;
            });
        });
    };
    const handleDeleteQualificationGroup = (groupId: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce groupe ? Les qualifications ne seront pas supprimées mais désassignées.")) {
            setQualificationGroups(prev => prev.filter(g => g.id !== groupId));
            setQualifications(prev => prev.map(q => q.groupId === groupId ? { ...q, groupId: null } : q));
        }
    };

    // DIDs and Trunks
    const handleSaveDid = (did: Did) => {
        setDids(prev => {
            const index = prev.findIndex(d => d.id === did.id);
            if (index > -1) {
                const newDids = [...prev];
                newDids[index] = did;
                return newDids;
            }
            return [...prev, did];
        });
    };
    const handleDeleteDid = (didId: string) => setDids(prev => prev.filter(d => d.id !== didId));
    const handleSaveTrunk = (trunk: Trunk) => {
        setTrunks(prev => {
            const index = prev.findIndex(t => t.id === trunk.id);
            if (index > -1) {
                const newTrunks = [...prev];
                newTrunks[index] = trunk;
                return newTrunks;
            }
            return [...prev, trunk];
        });
    };
    const handleDeleteTrunk = (trunkId: string) => setTrunks(prev => prev.filter(t => t.id !== trunkId));
    
    // Sites
    const handleSaveSite = (site: Site) => {
        setSites(prev => {
            const index = prev.findIndex(s => s.id === site.id);
            if (index > -1) {
                const newSites = [...prev];
                newSites[index] = site;
                return newSites;
            }
            return [...prev, site];
        });
    };
    const handleDeleteSite = (siteId: string) => setSites(prev => prev.filter(s => s.id !== siteId));

    // Audio Files
    const handleSaveAudioFile = (file: AudioFile) => {
        setAudioFiles(prev => {
            const index = prev.findIndex(f => f.id === file.id);
            if (index > -1) {
                const newFiles = [...prev];
                newFiles[index] = file;
                return newFiles;
            }
            return [...prev, file];
        });
    };
    const handleDeleteAudioFile = (fileId: string) => setAudioFiles(prev => prev.filter(f => f.id !== fileId));

    // Planning
    const handleSavePlanningEvent = (event: PlanningEvent) => {
        setPlanningEvents(prev => {
            const index = prev.findIndex(e => e.id === event.id);
            if (index > -1) {
                const newEvents = [...prev];
                newEvents[index] = event;
                return newEvents;
            }
            return [...prev, event];
        });
    };
    const handleDeletePlanningEvent = (eventId: string) => setPlanningEvents(prev => prev.filter(e => e.id !== eventId));
    
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
    
    // Props for the currently active component
    const featureComponentProps: any = {
        feature: activeFeature,
        currentUser,
        // Pass all data and handlers
        users, onSaveUser: handleSaveUser, onDeleteUser: handleDeleteUser, onGenerateUsers: handleGenerateUsers, onImportUsers: handleGenerateUsers,
        userGroups, onSaveUserGroup: handleSaveUserGroup, onDeleteUserGroup: handleDeleteUserGroup,
        campaigns, onSaveCampaign: handleSaveCampaign, onDeleteCampaign: handleDeleteCampaign, onImportContacts: handleImportContacts,
        savedScripts, onSaveOrUpdateScript: handleSaveOrUpdateScript, onDeleteScript: handleDeleteScript, onDuplicateScript: handleDuplicateScript,
        ivrFlows, onSaveOrUpdateIvrFlow: handleSaveOrUpdateIvrFlow, onDeleteIvrFlow: handleDeleteIvrFlow, onDuplicateIvrFlow: handleDuplicateIvrFlow,
        qualifications, onSaveQualification: handleSaveQualification, onDeleteQualification: handleDeleteQualification,
        qualificationGroups, onSaveQualificationGroup: handleSaveQualificationGroup, onDeleteQualificationGroup: handleDeleteQualificationGroup,
        dids, onSaveDid: handleSaveDid, onDeleteDid: handleDeleteDid,
        trunks, onSaveTrunk: handleSaveTrunk, onDeleteTrunk: handleDeleteTrunk,
        sites, onSaveSite: handleSaveSite, onDeleteSite: handleDeleteSite,
        audioFiles, onSaveAudioFile: handleSaveAudioFile, onDeleteAudioFile: handleDeleteAudioFile,
        planningEvents, onSavePlanningEvent: handleSavePlanningEvent, onDeletePlanningEvent: handleDeletePlanningEvent,
        personalCallbacks,
        systemConnectionSettings, onSaveSystemConnectionSettings: setSystemConnectionSettings,
        // For ModuleSettingsManager
        features, moduleVisibility, onSaveVisibilitySettings: setModuleVisibility,
        // For Supervision & Reporting
        callHistory: mockData.callHistory as CallHistoryRecord[],
        agentSessions: mockData.agentSessions as AgentSession[],
        // For Monitoring
        systemLogs: mockData.systemLogs as SystemLog[],
        versionInfo: mockData.versionInfo as VersionInfo,
        connectivityServices: mockData.connectivityServices as ConnectivityService[],
        backupLogs,
        backupSchedule,
        onSaveBackupSchedule: setBackupSchedule,
        onRunBackup: handleRunBackup,
        activityTypes: mockData.activityTypes as ActivityType[],
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
