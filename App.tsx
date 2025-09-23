
import React, { useState, useEffect, useCallback } from 'react';
import type { Feature, User, FeatureId, ModuleVisibility, SavedScript, Page, ScriptBlock, Campaign, Contact, UserGroup, Site, Qualification, QualificationGroup, IvrFlow, AudioFile, Trunk, Did, BackupLog, BackupSchedule, AgentSession, CallHistoryRecord, SystemLog, VersionInfo, ConnectivityService, ActivityType, PlanningEvent, SystemConnectionSettings } from './types';
import { features } from './data/features.ts';
import Sidebar from './components/Sidebar.tsx';
import FeatureDetail from './components/FeatureDetail.tsx';
import LoginScreen from './components/LoginScreen.tsx';
import AgentView from './components/AgentView.tsx';
import Header from './components/Header.tsx';
import MonitoringDashboard from './components/MonitoringDashboard.tsx';
import { mockData as initialMockData } from './data/mockData';


const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeFeatureId, setActiveFeatureId] = useState<FeatureId>('users');
    const [allData, setAllData] = useState(initialMockData);
    const [activeView, setActiveView] = useState<'app' | 'monitoring'>('app');
    
    // Simulate loading data on mount
    useEffect(() => {
        // In a real app, this would be an API call
        setAllData(initialMockData);
    }, []);

    const handleLoginSuccess = ({ user, token }: { user: User, token: string }) => {
        localStorage.setItem('authToken', token);
        setCurrentUser(user);
    };

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        setCurrentUser(null);
    };
    
    const handleSaveOrUpdate = (dataType: keyof typeof allData, data: any) => {
        setAllData(prevData => {
            const items = prevData[dataType] as any[];
            const index = items.findIndex((item: any) => item.id === data.id);
            if (index > -1) {
                const newItems = [...items];
                newItems[index] = data;
                return { ...prevData, [dataType]: newItems };
            } else {
                return { ...prevData, [dataType]: [...items, data] };
            }
        });
    };

    const handleDelete = (dataType: keyof typeof allData, id: string) => {
        setAllData(prevData => {
            const items = prevData[dataType] as any[];
            return { ...prevData, [dataType]: items.filter((item: any) => item.id !== id) };
        });
    };

    const handleSaveUser = (user: User, groupIds: string[]) => {
        handleSaveOrUpdate('users', user);
        // Also update group memberships
        setAllData(prevData => {
            const newGroups = prevData.userGroups.map(group => {
                const hasUser = group.memberIds.includes(user.id);
                const shouldHaveUser = groupIds.includes(group.id);
                if (hasUser && !shouldHaveUser) {
                    return { ...group, memberIds: group.memberIds.filter(id => id !== user.id) };
                }
                if (!hasUser && shouldHaveUser) {
                    return { ...group, memberIds: [...group.memberIds, user.id] };
                }
                return group;
            });
            return { ...prevData, userGroups: newGroups };
        });
    };
    
     const handleSaveUserGroup = (group: UserGroup) => {
        handleSaveOrUpdate('userGroups', group);
    };
    
    const handleSaveQualificationGroup = (group: QualificationGroup, assignedQualIds: string[]) => {
        handleSaveOrUpdate('qualificationGroups', group);
        setAllData(prevData => {
            const newQualifications = prevData.qualifications.map(q => {
                if(q.groupId === group.id && !assignedQualIds.includes(q.id)) { // Unassigned
                    return {...q, groupId: null};
                }
                if(assignedQualIds.includes(q.id) && q.groupId !== group.id) { // Assigned
                    return {...q, groupId: group.id};
                }
                return q;
            });
            return {...prevData, qualifications: newQualifications};
        });
    };
    
    const handleSaveCampaign = (campaign: Campaign) => {
        handleSaveOrUpdate('campaigns', campaign);
    };

    const handleImportContacts = (campaignId: string, contacts: Contact[]) => {
        setAllData(prev => {
            const campaignIndex = prev.campaigns.findIndex(c => c.id === campaignId);
            if (campaignIndex === -1) return prev;

            const updatedCampaigns = [...prev.campaigns];
            const existingContacts = updatedCampaigns[campaignIndex].contacts;
            updatedCampaigns[campaignIndex] = {
                ...updatedCampaigns[campaignIndex],
                contacts: [...existingContacts, ...contacts]
            };
            return { ...prev, campaigns: updatedCampaigns };
        });
    };

    if (!currentUser) {
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }

    if (currentUser.role === 'Agent') {
        return <AgentView currentUser={currentUser} onLogout={handleLogout} data={allData} />;
    }

    const activeFeature = features.find(f => f.id === activeFeatureId) || null;
    const FeatureComponent = activeFeature?.component;

    const renderFeatureComponent = () => {
        if (!FeatureComponent) return <FeatureDetail feature={activeFeature} />;
        
        const componentProps: any = {
            feature: activeFeature,
            currentUser,
            users: allData.users,
            campaigns: allData.campaigns,
            savedScripts: allData.savedScripts,
            userGroups: allData.userGroups,
            sites: allData.sites,
            qualifications: allData.qualifications,
            qualificationGroups: allData.qualificationGroups,
            ivrFlows: allData.ivrFlows,
            audioFiles: allData.audioFiles,
            trunks: allData.trunks,
            dids: allData.dids,
            backupLogs: allData.backupLogs,
            backupSchedule: allData.backupSchedule,
            callHistory: allData.callHistory,
            agentSessions: allData.agentSessions,
            systemLogs: allData.systemLogs,
            versionInfo: allData.versionInfo,
            connectivityServices: allData.connectivityServices,
            planningEvents: allData.planningEvents,
            activityTypes: allData.activityTypes,
            systemConnectionSettings: allData.systemConnectionSettings,
            moduleVisibility: allData.moduleVisibility,
            onSaveUser: handleSaveUser,
            onDeleteUser: (id: string) => handleDelete('users', id),
            onSaveUserGroup: handleSaveUserGroup,
            onDeleteUserGroup: (id: string) => handleDelete('userGroups', id),
            onSaveOrUpdateScript: (script: SavedScript) => handleSaveOrUpdate('savedScripts', script),
            onDeleteScript: (id: string) => handleDelete('savedScripts', id),
            onDuplicateScript: (id: string) => {
                const scriptToCopy = allData.savedScripts.find(s => s.id === id);
                if (scriptToCopy) {
                    const newScript = { ...scriptToCopy, id: `script-${Date.now()}`, name: `${scriptToCopy.name} (Copie)` };
                    handleSaveOrUpdate('savedScripts', newScript);
                }
            },
            onSaveCampaign: handleSaveCampaign,
            onDeleteCampaign: (id: string) => handleDelete('campaigns', id),
            onImportContacts: handleImportContacts,
            onSaveQualification: (q: Qualification) => handleSaveOrUpdate('qualifications', q),
            onDeleteQualification: (id: string) => handleDelete('qualifications', id),
            onSaveQualificationGroup: handleSaveQualificationGroup,
            onDeleteQualificationGroup: (id: string) => handleDelete('qualificationGroups', id),
             onSaveOrUpdateIvrFlow: (flow: IvrFlow) => handleSaveOrUpdate('ivrFlows', flow),
            onDeleteIvrFlow: (id: string) => handleDelete('ivrFlows', id),
            onDuplicateIvrFlow: (id: string) => {
                 const flowToCopy = allData.ivrFlows.find(f => f.id === id);
                if (flowToCopy) {
                    const newFlow = { ...flowToCopy, id: `ivr-flow-${Date.now()}`, name: `${flowToCopy.name} (Copie)` };
                    handleSaveOrUpdate('ivrFlows', newFlow);
                }
            },
            onSaveAudioFile: (file: AudioFile) => handleSaveOrUpdate('audioFiles', file),
            onDeleteAudioFile: (id: string) => handleDelete('audioFiles', id),
            onSaveTrunk: (trunk: Trunk) => handleSaveOrUpdate('trunks', trunk),
            onDeleteTrunk: (id: string) => handleDelete('trunks', id),
            onSaveDid: (did: Did) => handleSaveOrUpdate('dids', did),
            onDeleteDid: (id: string) => handleDelete('dids', id),
            onSaveSite: (site: Site) => handleSaveOrUpdate('sites', site),
            onDeleteSite: (id: string) => handleDelete('sites', id),
            onSavePlanningEvent: (event: PlanningEvent) => handleSaveOrUpdate('planningEvents', event),
            onDeletePlanningEvent: (id: string) => handleDelete('planningEvents', id),
            apiCall: async (url: string, method: string, body?: any) => {
                // Mock API call for DatabaseManager/MonitoringDashboard
                console.log(`Mock API Call: ${method} ${url}`, body);
                if (url.includes('system-stats')) {
                    return {
                        cpu: { brand: 'Intel Core i7-9750H', load: (Math.random() * 30 + 5).toFixed(1) },
                        ram: { total: 16 * 1024 * 1024 * 1024, used: (Math.random() * 8 + 4) * 1024 * 1024 * 1024 },
                        disk: { total: 512 * 1024 * 1024 * 1024, used: 250 * 1024 * 1024 * 1024 },
                        recordings: { size: 12.5 * 1024 * 1024 * 1024, files: 12345 },
                    };
                }
                return { success: true };
            },
        };
        
        return <FeatureComponent {...componentProps} />;
    };

    return (
        <div className="h-screen w-screen flex flex-col font-sans bg-slate-50">
            <div className="flex flex-1 min-h-0">
                <Sidebar
                    features={features}
                    activeFeatureId={activeFeatureId}
                    onSelectFeature={(id) => { setActiveFeatureId(id); setActiveView('app'); }}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    moduleVisibility={allData.moduleVisibility}
                />
                <div className="flex-1 flex flex-col min-w-0">
                    <Header activeView={activeView} onViewChange={setActiveView} />
                    <main className="flex-1 overflow-y-auto p-8">
                         {activeView === 'app' ? renderFeatureComponent() : <MonitoringDashboard {...({
                            feature: features.find(f => f.id === 'monitoring'),
                            systemLogs: allData.systemLogs,
                            versionInfo: allData.versionInfo,
                            connectivityServices: allData.connectivityServices,
                            apiCall: async () => ({})
                         } as any)} />}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default App;
