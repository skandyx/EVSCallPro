
import React, { useState, useEffect, useCallback } from 'react';
import { features } from './data/features.ts';
import { mockData } from './data/mockData.ts';
import type {
    Feature, FeatureId, User, Campaign, UserGroup, SavedScript, IvrFlow,
    Contact, Qualification, QualificationGroup, Did, Trunk, Site, AudioFile,
    PlanningEvent, ActivityType, ModuleVisibility, BackupSchedule, SystemConnectionSettings,
} from './types.ts';
import Sidebar from './components/Sidebar.tsx';
import LoginScreen from './components/LoginScreen.tsx';
import AgentView from './components/AgentView.tsx';
import FeatureDetail from './components/FeatureDetail.tsx';
import UserManager from './components/UserManager.tsx';
import GroupManager from './components/GroupManager.tsx';
import ScriptFeature from './components/ScriptFeature.tsx';
import IvrFeature from './components/IvrFeature.tsx';
import OutboundCampaignsManager from './components/OutboundCampaignsManager.tsx';
import QualificationsManager from './components/QualificationsManager.tsx';
import TrunkManager from './components/TrunkManager.tsx';
import DidManager from './components/DidManager.tsx';
import SiteManager from './components/SiteManager.tsx';
import SupervisionDashboard from './components/SupervisionDashboard.tsx';
import ReportingDashboard from './components/ReportingDashboard.tsx';
import HistoryViewer from './components/HistoryViewer.tsx';
import SessionViewer from './components/SessionViewer.tsx';
import AudioManager from './components/AudioManager.tsx';
import MaintenanceManager from './components/MaintenanceManager.tsx';
import PlanningManager from './components/PlanningManager.tsx';
import SystemConnectionManager from './components/SystemConnectionManager.tsx';
import ModuleSettingsManager from './components/ModuleSettingsManager.tsx';
import ApiDocs from './components/ApiDocs.tsx';
import HelpCenter from './components/HelpCenter.tsx';

// Define a type for the whole data structure, which can be null during loading
type AppData = typeof mockData | null;

const App: React.FC = () => {
    // --- STATE MANAGEMENT ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeFeatureId, setActiveFeatureId] = useState<FeatureId | null>(null);
    
    // State is now initialized to null and will be fetched from the backend.
    const [data, setData] = useState<AppData>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [moduleVisibility, setModuleVisibility] = useState<ModuleVisibility>(() => {
        const saved = localStorage.getItem('moduleVisibility');
        return saved ? JSON.parse(saved) : { categories: {}, features: {} };
    });

    // --- DATA FETCHING on App Load ---
    useEffect(() => {
        const fetchApplicationData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const response = await fetch('/api/application-data');
                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(`Network response was not ok: ${response.statusText} - ${errorBody}`);
                }
                const appData = await response.json();
                setData(appData);
            } catch (err) {
                console.error("Failed to fetch application data:", err);
                setError((err as Error).message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchApplicationData();
    }, []);
    
    // --- REAL API LOGIC ---
    const handleApiCall = async (endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: any) => {
        try {
            const response = await fetch(`/api${endpoint}`, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ details: response.statusText }));
                throw new Error(errorData.details || 'Network response was not ok');
            }
            
            if (response.status === 204) return null; // No content for DELETE
            return await response.json();

        } catch (err) {
            console.error(`API call failed: ${method} ${endpoint}`, err);
            alert(`API Error: ${(err as Error).message}`);
            throw err;
        }
    };
    
    // Helper to safely update nested state
    const updateData = (updater: (draft: NonNullable<AppData>) => void) => {
        setData(prev => {
            if (!prev) return null;
            const draft = JSON.parse(JSON.stringify(prev));
            updater(draft);
            return draft;
        });
    };
    
    // --- HANDLERS ---
    const handleLogin = (user: User) => {
        setCurrentUser(user);
        setActiveFeatureId(user.role === 'Agent' ? null : 'supervision');
    };
    const handleLogout = () => {
        setCurrentUser(null);
        setActiveFeatureId(null);
    };

    // --- DATA MUTATION HANDLERS (Connected to the REAL API) ---
    const handleSaveUser = async (user: User, groupIds: string[]) => {
        const isNew = user.id.startsWith('new-');
        const endpoint = isNew ? '/users' : `/users/${user.id}`;
        const method = isNew ? 'POST' : 'PUT';
        const savedUser = await handleApiCall(endpoint, method, { user, groupIds });

        updateData(draft => {
            if (isNew) {
                draft.users.push(savedUser);
            } else {
                const index = draft.users.findIndex(u => u.id === savedUser.id);
                if (index > -1) draft.users[index] = { ...draft.users[index], ...savedUser };
            }
            // Update group memberships
            draft.userGroups.forEach(g => {
                g.memberIds = g.memberIds.filter(mid => mid !== savedUser.id);
                if (groupIds.includes(g.id)) {
                    g.memberIds.push(savedUser.id);
                }
            });
        });
    };

    const handleDeleteUser = async (userId: string) => {
        await handleApiCall(`/users/${userId}`, 'DELETE');
        updateData(draft => {
            draft.users = draft.users.filter(u => u.id !== userId);
            draft.userGroups.forEach(g => g.memberIds = g.memberIds.filter(mid => mid !== userId));
        });
    };

    const handleGenerateUsers = async (usersToCreate: User[]) => {
        alert(`Génération de ${usersToCreate.length} utilisateurs en cours...`);
        const createdUsers = [];
        for (const user of usersToCreate) {
            const savedUser = await handleApiCall('/users', 'POST', { user, groupIds: [] });
            createdUsers.push(savedUser);
        }
        updateData(draft => {
            draft.users.push(...createdUsers);
        });
        alert('Génération terminée !');
    };

    const handleSaveOrUpdateScript = async (script: SavedScript) => {
        const isNew = !script.id.startsWith('script-'); // Logic assumes existing IDs dont start with pattern
        const endpoint = isNew ? '/scripts' : `/scripts/${script.id}`;
        const method = isNew ? 'POST' : 'PUT';
        const savedScript = await handleApiCall(endpoint, method, script);
        updateData(draft => {
            if (isNew) { draft.savedScripts.push(savedScript); }
            else { const idx = draft.savedScripts.findIndex(s => s.id === savedScript.id); if (idx > -1) draft.savedScripts[idx] = savedScript; }
        });
    };

    const handleDeleteScript = async (scriptId: string) => {
        await handleApiCall(`/scripts/${scriptId}`, 'DELETE');
        updateData(draft => { draft.savedScripts = draft.savedScripts.filter(s => s.id !== scriptId); });
    };

    const handleDuplicateScript = async (scriptId: string) => {
        const newScript = await handleApiCall(`/scripts/${scriptId}/duplicate`, 'POST');
        updateData(draft => { draft.savedScripts.push(newScript); });
    };

    const handleSaveOrUpdateIvrFlow = async (flow: IvrFlow) => {
        const isNew = !flow.id.startsWith('ivr-flow-');
        const endpoint = isNew ? '/ivr-flows' : `/ivr-flows/${flow.id}`;
        const method = isNew ? 'POST' : 'PUT';
        const savedFlow = await handleApiCall(endpoint, method, flow);
        updateData(draft => {
            if (isNew) { draft.savedIvrFlows.push(savedFlow); }
            else { const idx = draft.savedIvrFlows.findIndex(f => f.id === savedFlow.id); if (idx > -1) draft.savedIvrFlows[idx] = savedFlow; }
        });
    };
    
    const handleDeleteIvrFlow = async (flowId: string) => {
        await handleApiCall(`/ivr-flows/${flowId}`, 'DELETE');
        updateData(draft => { draft.savedIvrFlows = draft.savedIvrFlows.filter(f => f.id !== flowId); });
    };

    const handleDuplicateIvrFlow = async (flowId: string) => {
        const newFlow = await handleApiCall(`/ivr-flows/${flowId}/duplicate`, 'POST');
        updateData(draft => { draft.savedIvrFlows.push(newFlow); });
    };

    const handleSaveCampaign = async (campaign: Campaign) => {
        const isNew = campaign.id.startsWith('campaign-');
        const endpoint = isNew ? '/campaigns' : `/campaigns/${campaign.id}`;
        const method = isNew ? 'POST' : 'PUT';
        const savedCampaign = await handleApiCall(endpoint, method, campaign);
        updateData(draft => {
            if (isNew) {
                draft.campaigns.push({ ...savedCampaign, contacts: [], assignedUserIds: campaign.assignedUserIds });
            } else {
                const index = draft.campaigns.findIndex(c => c.id === savedCampaign.id);
                if (index > -1) {
                    draft.campaigns[index] = { ...draft.campaigns[index], ...savedCampaign, assignedUserIds: campaign.assignedUserIds };
                }
            }
        });
    };

    const handleDeleteCampaign = async (campaignId: string) => {
        await handleApiCall(`/campaigns/${campaignId}`, 'DELETE');
        updateData(draft => { draft.campaigns = draft.campaigns.filter(c => c.id !== campaignId); });
    };

    const handleImportContacts = async (campaignId: string, newContacts: Contact[]) => {
        await handleApiCall(`/campaigns/${campaignId}/contacts`, 'POST', { contacts: newContacts });
        updateData(draft => {
            const camp = draft.campaigns.find(c => c.id === campaignId);
            if (camp) camp.contacts.push(...newContacts);
        });
    };

    const handleSaveUserGroup = async (group: UserGroup) => {
        const isNew = group.id.startsWith('group-');
        const endpoint = isNew ? '/groups' : `/groups/${group.id}`;
        const method = isNew ? 'POST' : 'PUT';
        const savedGroup = await handleApiCall(endpoint, method, group);
        updateData(draft => {
            const finalGroup = { ...savedGroup, memberIds: group.memberIds };
            if (isNew) { draft.userGroups.push(finalGroup); }
            else { const idx = draft.userGroups.findIndex(g => g.id === finalGroup.id); if (idx > -1) draft.userGroups[idx] = finalGroup; }
        });
    };
    
    const handleDeleteUserGroup = async (groupId: string) => {
        await handleApiCall(`/groups/${groupId}`, 'DELETE');
        updateData(draft => { draft.userGroups = draft.userGroups.filter(g => g.id !== groupId); });
    };

    const handleSaveQualification = async (q: Qualification) => {
        const isNew = q.id.startsWith('qual-');
        const endpoint = isNew ? '/qualifications' : `/qualifications/${q.id}`;
        const method = isNew ? 'POST' : 'PUT';
        const savedQual = await handleApiCall(endpoint, method, q);
        updateData(draft => {
            if (isNew) { draft.qualifications.push(savedQual); }
            else { const idx = draft.qualifications.findIndex(i => i.id === savedQual.id); if (idx > -1) draft.qualifications[idx] = savedQual; }
        });
    };

    const handleDeleteQualification = async (id: string) => {
        await handleApiCall(`/qualifications/${id}`, 'DELETE');
        updateData(draft => { draft.qualifications = draft.qualifications.filter(i => i.id !== id); });
    };

    const handleSaveQualificationGroup = async (g: QualificationGroup, assignedQualIds: string[]) => {
        const isNew = g.id.startsWith('qg-');
        const endpoint = isNew ? '/qualification-groups' : `/qualification-groups/${g.id}`;
        const method = isNew ? 'POST' : 'PUT';
        const savedGroup = await handleApiCall(endpoint, method, { group: g, assignedQualIds });
        
        updateData(draft => {
            if (isNew) { draft.qualificationGroups.push(savedGroup); }
            else {
                const idx = draft.qualificationGroups.findIndex(i => i.id === savedGroup.id);
                if (idx > -1) draft.qualificationGroups[idx] = savedGroup;
            }
            draft.qualifications.forEach(qual => {
                if (qual.groupId === savedGroup.id && !qual.isStandard) qual.groupId = null;
                if (assignedQualIds.includes(qual.id)) qual.groupId = savedGroup.id;
            });
        });
    };

    const handleDeleteQualificationGroup = async (id: string) => {
        await handleApiCall(`/qualification-groups/${id}`, 'DELETE');
        updateData(draft => {
            draft.qualificationGroups = draft.qualificationGroups.filter(i => i.id !== id);
            draft.qualifications.forEach(q => { if (q.groupId === id) q.groupId = null; });
        });
    };

    const handleUpdateGroupQualifications = async (groupId: string, qualIds: string[]) => {
        if (!data) return;
        const group = data.qualificationGroups.find(g => g.id === groupId);
        if (group) {
            await handleSaveQualificationGroup(group, qualIds);
        }
    };

    const createSimpleHandler = <T extends {id: string}>(resource: string, dataKey: keyof NonNullable<AppData>, idPrefix: string) => {
        const handleSave = async (item: T) => {
            const isNew = item.id.startsWith(idPrefix);
            const endpoint = isNew ? `/${resource}` : `/${resource}/${item.id}`;
            const method = isNew ? 'POST' : 'PUT';
            const savedItem = await handleApiCall(endpoint, method, item);
            updateData(draft => {
                // Fix: Cast to unknown first to satisfy TypeScript's stricter generic type checking.
                const collection = draft[dataKey] as unknown as T[];
                if (isNew) { collection.push(savedItem); }
                else { const idx = collection.findIndex(i => i.id === savedItem.id); if (idx > -1) collection[idx] = savedItem; }
            });
        };
        const handleDelete = async (itemId: string) => {
            await handleApiCall(`/${resource}/${itemId}`, 'DELETE');
            updateData(draft => {
                // Fix: Cast to unknown first to satisfy TypeScript's stricter generic type checking.
                const collection = draft[dataKey] as unknown as T[];
                // Fix: Cast to unknown first to satisfy TypeScript's stricter generic type checking.
                (draft[dataKey] as unknown as T[]) = collection.filter(i => i.id !== itemId);
            });
        };
        return { handleSave, handleDelete };
    };

    const { handleSave: handleSaveTrunk, handleDelete: handleDeleteTrunk } = createSimpleHandler<Trunk>('trunks', 'trunks', 'trunk-');
    const { handleSave: handleSaveDid, handleDelete: handleDeleteDid } = createSimpleHandler<Did>('dids', 'dids', 'did-');
    const { handleSave: handleSaveSite, handleDelete: handleDeleteSite } = createSimpleHandler<Site>('sites', 'sites', 'site-');
    const { handleSave: handleSaveAudioFile, handleDelete: handleDeleteAudioFile } = createSimpleHandler<AudioFile>('audio-files', 'audioFiles', 'audio-');
    const { handleSave: handleSavePlanningEvent, handleDelete: handleDeletePlanningEvent } = createSimpleHandler<PlanningEvent>('planning-events', 'planningEvents', 'plan-');

    const handleSaveBackupSchedule = (s: BackupSchedule) => alert("La sauvegarde de la planification n'est pas implémentée dans le backend.");
    const handleSaveSystemConnectionSettings = (s: SystemConnectionSettings) => alert("La sauvegarde des paramètres système n'est pas implémentée dans le backend.");

    const handleSaveVisibilitySettings = (visibility: ModuleVisibility) => {
        setModuleVisibility(visibility);
        localStorage.setItem('moduleVisibility', JSON.stringify(visibility));
    };

    // --- RENDER LOGIC ---
    if (isLoading) {
        return <div className="h-screen w-screen flex items-center justify-center">Chargement de l'application...</div>;
    }
    
    if (error) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center text-red-500 p-8">
                <h2 className="text-2xl font-bold mb-4">Erreur de Connexion</h2>
                <p className="text-center">Impossible de charger les données de l'application. Veuillez vérifier que le serveur backend est en cours d'exécution et accessible.</p>
                <pre className="mt-4 bg-red-50 p-4 rounded text-xs w-full max-w-2xl overflow-auto">{error}</pre>
            </div>
        );
    }
    
    if (!data) {
        return <div className="h-screen w-screen flex items-center justify-center text-red-500">Erreur critique : Aucune donnée n'a été chargée.</div>;
    }
    
    if (!currentUser) {
        return <LoginScreen users={data.users} onLoginSuccess={handleLogin} />;
    }

    if (currentUser.role === 'Agent') {
        return <AgentView agent={currentUser} campaigns={data.campaigns} savedScripts={data.savedScripts} sites={data.sites} personalCallbacks={data.personalCallbacks} qualifications={data.qualifications} qualificationGroups={data.qualificationGroups} onLogout={handleLogout} />;
    }

    const activeFeature = features.find(f => f.id === activeFeatureId);
    
    const renderFeatureComponent = () => {
        if (!activeFeature) return <FeatureDetail feature={null} />;
        
        switch (activeFeature.id) {
            case 'users': return <UserManager feature={activeFeature} users={data.users} campaigns={data.campaigns} userGroups={data.userGroups} sites={data.sites} currentUser={currentUser} onSaveUser={handleSaveUser} onDeleteUser={handleDeleteUser} onGenerateUsers={handleGenerateUsers} onImportUsers={handleGenerateUsers} />;
            case 'groups': return <GroupManager feature={activeFeature} users={data.users} userGroups={data.userGroups} onSaveUserGroup={handleSaveUserGroup} onDeleteUserGroup={handleDeleteUserGroup} />;
            case 'scripts': return <ScriptFeature feature={activeFeature} savedScripts={data.savedScripts} onSaveOrUpdateScript={handleSaveOrUpdateScript} onDeleteScript={handleDeleteScript} onDuplicateScript={handleDuplicateScript} />;
            case 'ivr': return <IvrFeature feature={activeFeature} ivrFlows={data.savedIvrFlows} onSaveOrUpdateIvrFlow={handleSaveOrUpdateIvrFlow} onDeleteIvrFlow={handleDeleteIvrFlow} onDuplicateIvrFlow={handleDuplicateIvrFlow}/>;
            case 'outbound': return <OutboundCampaignsManager feature={activeFeature} campaigns={data.campaigns} users={data.users} savedScripts={data.savedScripts} qualificationGroups={data.qualificationGroups} onSaveCampaign={handleSaveCampaign} onDeleteCampaign={handleDeleteCampaign} onImportContacts={handleImportContacts} />;
            // Fix: Removed `onUpdateGroupQualifications` prop as it is redundant. The logic is handled by `onSaveQualificationGroup`.
            case 'qualifications': return <QualificationsManager feature={activeFeature} qualifications={data.qualifications} qualificationGroups={data.qualificationGroups} onSaveQualification={handleSaveQualification} onDeleteQualification={handleDeleteQualification} onSaveQualificationGroup={handleSaveQualificationGroup} onDeleteQualificationGroup={handleDeleteQualificationGroup} />;
            case 'trunks': return <TrunkManager feature={activeFeature} trunks={data.trunks} onSaveTrunk={handleSaveTrunk} onDeleteTrunk={handleDeleteTrunk} />;
            case 'dids': return <DidManager feature={activeFeature} dids={data.dids} trunks={data.trunks} ivrFlows={data.savedIvrFlows} onSaveDid={handleSaveDid} onDeleteDid={handleDeleteDid} />;
            case 'sites-config': return <SiteManager feature={activeFeature} sites={data.sites} onSaveSite={handleSaveSite} onDeleteSite={handleDeleteSite} />;
            case 'supervision': return <SupervisionDashboard feature={activeFeature} users={data.users} campaigns={data.campaigns} currentUser={currentUser} />;
            case 'reporting': return <ReportingDashboard feature={activeFeature} callHistory={data.callHistory} agentSessions={data.agentSessions} users={data.users} campaigns={data.campaigns} qualifications={data.qualifications} />;
            case 'history': return <HistoryViewer feature={activeFeature} callHistory={data.callHistory} users={data.users} campaigns={data.campaigns} qualifications={data.qualifications} />;
            case 'sessions': return <SessionViewer feature={activeFeature} agentSessions={data.agentSessions} users={data.users} />;
            case 'audio': return <AudioManager feature={activeFeature} audioFiles={data.audioFiles} onSaveAudioFile={handleSaveAudioFile} onDeleteAudioFile={handleDeleteAudioFile} />;
            case 'maintenance': return <MaintenanceManager feature={activeFeature} backupLogs={data.backupLogs} backupSchedule={data.backupSchedule} onSaveBackupSchedule={handleSaveBackupSchedule} onRunBackup={() => alert("Backup started!")} />;
            case 'planning': return <PlanningManager feature={activeFeature} planningEvents={data.planningEvents} activityTypes={data.activityTypes} users={data.users} userGroups={data.userGroups} onSavePlanningEvent={handleSavePlanningEvent} onDeletePlanningEvent={handleDeletePlanningEvent} />;
            case 'system-connection': return <SystemConnectionManager feature={activeFeature} systemConnectionSettings={data.systemConnectionSettings} onSaveSystemConnectionSettings={handleSaveSystemConnectionSettings} />;
            case 'module-settings': return <ModuleSettingsManager feature={activeFeature} features={features} moduleVisibility={moduleVisibility} onSaveVisibilitySettings={handleSaveVisibilitySettings} />;
            case 'api-docs': return <ApiDocs feature={activeFeature} />;
            case 'help': return <HelpCenter feature={activeFeature} />;
            default: return <FeatureDetail feature={activeFeature} />;
        }
    };
    
    return (
        <div className="h-screen w-screen flex bg-slate-100 font-sans">
            <Sidebar features={features} activeFeatureId={activeFeatureId} onSelectFeature={(id: FeatureId) => setActiveFeatureId(id)} currentUser={currentUser} onLogout={handleLogout} moduleVisibility={moduleVisibility} />
            <main className="flex-1 flex flex-col overflow-hidden">
                 <div className="flex-1 p-8 overflow-y-auto">
                    {renderFeatureComponent()}
                 </div>
            </main>
        </div>
    );
};

export default App;
