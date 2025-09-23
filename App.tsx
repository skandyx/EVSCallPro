

import React, { useState, useMemo, useEffect } from 'react';
// Fix: Corrected type imports to be more specific and complete.
import type {
    User,
    Feature,
    FeatureId,
    Campaign,
    Contact,
    SavedScript,
    QualificationGroup,
    UserGroup,
    Site,
    ModuleVisibility,
    IvrFlow,
    Qualification,
    Trunk,
    Did,
    AudioFile,
    BackupLog,
    BackupSchedule,
    SystemLog,
    VersionInfo,
    ConnectivityService,
    CallHistoryRecord,
    AgentSession,
    ActivityType,
    PlanningEvent,
    PersonalCallback,
    // FIX: Add ContactNote to support AgentView's note-saving feature.
    ContactNote,
    SystemConnectionSettings
} from './types';
import { mockData } from './data/mockData';
import { features } from './data/features';
import Sidebar from './components/Sidebar';
import LoginScreen from './components/LoginScreen';
import AgentView from './components/AgentView';
import Header from './components/Header';
import MonitoringDashboard from './components/MonitoringDashboard';

const App: React.FC = () => {
    // --- STATE MANAGEMENT ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<'app' | 'monitoring'>('app');
    const [activeFeatureId, setActiveFeatureId] = useState<FeatureId | null>(null);

    // --- DATA STATE (simulating a database) ---
    const [data, setData] = useState(mockData);

    // --- UI LOGIC ---
    const activeFeature = useMemo(() => {
        if (!activeFeatureId) return null;
        return features.find(f => f.id === activeFeatureId) || null;
    }, [activeFeatureId]);

    const [moduleVisibility, setModuleVisibility] = useState<ModuleVisibility>({
        categories: {},
        features: {}
    });

    // --- EVENT HANDLERS / API SIMULATION ---
    const handleLoginSuccess = ({ user, token }: { user: User, token:string }) => {
        setCurrentUser(user);
        setAuthToken(token);
        if (user.role !== 'Agent') {
            setActiveFeatureId('supervision'); // Default view for non-agents
        }
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setAuthToken(null);
        setActiveFeatureId(null);
    };

    const handleSaveUser = (userToSave: User, groupIds: string[]) => {
        setData(prev => {
            const userIndex = prev.users.findIndex(u => u.id === userToSave.id);
            let newUsers;
            if (userIndex > -1) {
                newUsers = [...prev.users];
                newUsers[userIndex] = userToSave;
            } else {
                newUsers = [...prev.users, userToSave];
            }

            const newGroups = prev.userGroups.map(g => {
                const newMemberIds = g.memberIds.filter(id => id !== userToSave.id);
                if (groupIds.includes(g.id)) {
                    newMemberIds.push(userToSave.id);
                }
                return { ...g, memberIds: [...new Set(newMemberIds)] };
            });

            return { ...prev, users: newUsers, userGroups: newGroups };
        });
    };
    
    // Generic save handler
    const handleSave = <T extends { id: string }>(dataType: keyof typeof data, itemToSave: T) => {
        setData(prev => {
            // FIX: Cast to 'unknown' first to satisfy TypeScript's strict generic type checking.
            const collection = prev[dataType] as unknown as T[];
            const itemIndex = collection.findIndex(item => item.id === itemToSave.id);
            const newCollection = [...collection];
            if (itemIndex > -1) {
                newCollection[itemIndex] = itemToSave;
            } else {
                newCollection.push(itemToSave);
            }
            return { ...prev, [dataType]: newCollection };
        });
    };
    
    // Generic delete handler
    const handleDelete = <T extends { id: string }>(dataType: keyof typeof data, itemId: string) => {
         setData(prev => {
            // FIX: Cast to 'unknown' first to satisfy TypeScript's strict generic type checking.
            const collection = prev[dataType] as unknown as T[];
            return { ...prev, [dataType]: collection.filter(item => item.id !== itemId) };
        });
    };

    const handleImportContacts = (campaignId: string, newContacts: Contact[], deduplicationConfig: { enabled: boolean; fieldIds: string[] }) => {
        setData(prev => {
            const newCampaigns = prev.campaigns.map(c => {
                if (c.id === campaignId) {
                    // Simple import for now, deduplication logic would be here
                    const updatedContacts = [...c.contacts, ...newContacts];
                    return { ...c, contacts: updatedContacts };
                }
                return c;
            });
            return { ...prev, campaigns: newCampaigns };
        });
    };

    const handleUpdateContact = (updatedContact: Contact) => {
        setData(prev => ({
            ...prev,
            campaigns: prev.campaigns.map(c => ({
                ...c,
                contacts: c.contacts.map(ct => ct.id === updatedContact.id ? updatedContact : ct)
            }))
        }));
    };
    
    const handleDeleteContacts = (contactIds: string[]) => {
        const idsToDelete = new Set(contactIds);
        setData(prev => ({
            ...prev,
            campaigns: prev.campaigns.map(c => ({
                ...c,
                contacts: c.contacts.filter(ct => !idsToDelete.has(ct.id))
            }))
        }));
    };

    // FIX: Implement handler for AgentView to request the next contact.
    const handleRequestNextContact = async (): Promise<{ contact: Contact; campaign: Campaign } | null> => {
        if (!currentUser) return null;
        const agentCampaigns = data.campaigns.filter(c => c.isActive && currentUser.campaignIds.includes(c.id));

        for (const campaign of agentCampaigns) {
            const contactIndex = campaign.contacts.findIndex(c => c.status === 'pending');
            if (contactIndex > -1) {
                const contactToCall = campaign.contacts[contactIndex];
                const updatedContact = { ...contactToCall, status: 'called' as const };
                
                handleUpdateContact(updatedContact);
                return { contact: updatedContact, campaign: campaign };
            }
        }
        return null;
    };

    // FIX: Implement handler for AgentView to save a contact note.
    const handleSaveContactNote = async (noteData: Omit<ContactNote, 'id' | 'createdAt'>): Promise<ContactNote> => {
        const newNote: ContactNote = {
            id: `note-${Date.now()}`,
            createdAt: new Date().toISOString(),
            ...noteData,
        };
        setData(prev => ({
            ...prev,
            contactNotes: [...(prev.contactNotes || []), newNote],
        }));
        return newNote;
    };

    const apiCall = async (url: string, method: string, body?: any) => {
        console.log(`API Call: ${method} ${url}`, body);
        if (url === '/api/system-stats') {
             return {
                cpu: { brand: 'Intel Core i7-9750H', load: (Math.random() * 40 + 10).toFixed(1) },
                ram: { total: 16 * 1024 * 1024 * 1024, used: (Math.random() * 8 + 4) * 1024 * 1024 * 1024 },
                disk: { total: 512 * 1024 * 1024 * 1024, used: 250 * 1024 * 1024 * 1024 },
                recordings: { size: 12.5 * 1024 * 1024 * 1024, files: 12345 },
            };
        }
        if (url === '/api/db-query' && method === 'POST') {
             return {
                columns: ['id', 'name', 'status'],
                rows: [{id: 1, name: 'Test Query', status: 'Success'}],
                rowCount: 1,
            }
        }
        if(url === '/api/db-schema' && method === 'GET') {
            return {
                users: ['id', 'login_id', 'first_name', 'last_name', 'role'],
                campaigns: ['id', 'name', 'is_active', 'script_id'],
                contacts: ['id', 'campaign_id', 'phone_number', 'status'],
            }
        }
        return { success: true };
    };

    // --- RENDER LOGIC ---
    if (!currentUser) {
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }

    if (currentUser.role === 'Agent') {
        // FIX: Pass the required onRequestNextContact and onSaveContactNote props to AgentView.
        return <AgentView 
            currentUser={currentUser} 
            onLogout={handleLogout} 
            data={data} 
            onRequestNextContact={handleRequestNextContact}
            onSaveContactNote={handleSaveContactNote}
        />;
    }

    const ActiveComponent = activeFeature?.component;
    
    const componentProps = {
        feature: activeFeature,
        currentUser: currentUser,
        // Data props
        users: data.users,
        userGroups: data.userGroups,
        campaigns: data.campaigns,
        savedScripts: data.savedScripts,
        qualificationGroups: data.qualificationGroups,
        qualifications: data.qualifications,
        sites: data.sites,
        trunks: data.trunks,
        dids: data.dids,
        ivrFlows: data.savedIvrFlows,
        audioFiles: data.audioFiles,
        backupLogs: data.backupLogs,
        backupSchedule: data.backupSchedule,
        callHistory: data.callHistory,
        agentSessions: data.agentSessions,
        planningEvents: data.planningEvents,
        activityTypes: data.activityTypes,
        systemConnectionSettings: data.systemConnectionSettings,
        features: features,
        moduleVisibility: moduleVisibility,
        // Handler props
        onSaveUser: handleSaveUser,
        onDeleteUser: (id: string) => handleDelete('users', id),
        onGenerateUsers: (newUsers: User[]) => setData(prev => ({...prev, users: [...prev.users, ...newUsers]})),
        onImportUsers: (newUsers: User[]) => setData(prev => ({...prev, users: [...prev.users, ...newUsers]})),
        onSaveUserGroup: (group: UserGroup) => handleSave('userGroups', group),
        onDeleteUserGroup: (id: string) => handleDelete('userGroups', id),
        onSaveCampaign: (campaign: Campaign) => handleSave('campaigns', campaign),
        onDeleteCampaign: (id: string) => handleDelete('campaigns', id),
        onImportContacts: handleImportContacts,
        onUpdateContact: handleUpdateContact,
        onDeleteContacts: handleDeleteContacts,
        onSaveOrUpdateScript: (script: SavedScript) => handleSave('savedScripts', script),
        onDeleteScript: (id: string) => handleDelete('savedScripts', id),
        onDuplicateScript: (id: string) => {
            const scriptToCopy = data.savedScripts.find(s => s.id === id);
            if(scriptToCopy) {
                const newScript = {...scriptToCopy, id: `script-${Date.now()}`, name: `${scriptToCopy.name} (Copie)`};
                handleSave('savedScripts', newScript);
            }
        },
        onSaveOrUpdateIvrFlow: (flow: IvrFlow) => handleSave('savedIvrFlows', flow),
        onDeleteIvrFlow: (id: string) => handleDelete('savedIvrFlows', id),
        onDuplicateIvrFlow: (id: string) => {
            const flowToCopy = data.savedIvrFlows.find(f => f.id === id);
            if (flowToCopy) {
                const newFlow = {...flowToCopy, id: `ivr-flow-${Date.now()}`, name: `${flowToCopy.name} (Copie)`};
                handleSave('savedIvrFlows', newFlow);
            }
        },
        onSaveQualification: (qual: Qualification) => handleSave('qualifications', qual),
        onDeleteQualification: (id: string) => handleDelete('qualifications', id),
        onSaveQualificationGroup: (group: QualificationGroup, assignedQualIds: string[]) => {
            setData(prev => {
                const groupIndex = prev.qualificationGroups.findIndex(g => g.id === group.id);
                const newGroups = [...prev.qualificationGroups];
                if(groupIndex > -1) newGroups[groupIndex] = group; else newGroups.push(group);

                const newQuals = prev.qualifications.map(q => {
                    if (q.groupId === group.id) return {...q, groupId: null}; // unassign first
                    return q;
                }).map(q => {
                    if (assignedQualIds.includes(q.id)) return {...q, groupId: group.id};
                    return q;
                });
                return {...prev, qualificationGroups: newGroups, qualifications: newQuals};
            });
        },
        onDeleteQualificationGroup: (id: string) => handleDelete('qualificationGroups', id),
        onSaveSite: (site: Site) => handleSave('sites', site),
        onDeleteSite: (id: string) => handleDelete('sites', id),
        onSaveTrunk: (trunk: Trunk) => handleSave('trunks', trunk),
        onDeleteTrunk: (id: string) => handleDelete('trunks', id),
        onSaveDid: (did: Did) => handleSave('dids', did),
        onDeleteDid: (id: string) => handleDelete('dids', id),
        onSaveAudioFile: (file: AudioFile) => handleSave('audioFiles', file),
        onDeleteAudioFile: (id: string) => handleDelete('audioFiles', id),
        onSaveBackupSchedule: (schedule: BackupSchedule) => setData(prev => ({...prev, backupSchedule: schedule})),
        onRunBackup: () => alert("Sauvegarde manuelle lancée (simulation)"),
        onSavePlanningEvent: (event: PlanningEvent) => handleSave('planningEvents', event),
        onDeletePlanningEvent: (id: string) => handleDelete('planningEvents', id),
        onSaveVisibilitySettings: (visibility: ModuleVisibility) => setModuleVisibility(visibility),
        onSaveSystemConnectionSettings: (settings: SystemConnectionSettings) => setData(prev => ({...prev, systemConnectionSettings: settings})),
        apiCall,
    };

    return (
        <div className="h-screen w-screen flex bg-slate-100 font-sans">
            <Sidebar
                features={features}
                activeFeatureId={activeFeatureId}
                onSelectFeature={setActiveFeatureId}
                currentUser={currentUser}
                onLogout={handleLogout}
                moduleVisibility={moduleVisibility}
            />
            <main className="flex-1 flex flex-col overflow-hidden">
                <Header activeView={activeView} onViewChange={setActiveView} />
                <div className="flex-1 overflow-y-auto p-8">
                    {activeView === 'app' && ActiveComponent && React.createElement(ActiveComponent, componentProps)}
                    {activeView === 'monitoring' && <MonitoringDashboard 
                        systemLogs={data.systemLogs} 
                        versionInfo={data.versionInfo} 
                        connectivityServices={data.connectivityServices}
                        apiCall={apiCall}
                    />}
                </div>
            </main>
        </div>
    );
};

export default App;