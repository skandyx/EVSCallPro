import React, { useState, useMemo } from 'react';
import type { Feature, FeatureId, User, SavedScript, IvrFlow, Campaign, Qualification, QualificationGroup, Trunk, Did, Site, UserGroup, Contact, ModuleVisibility, PersonalCallback, SystemConnectionSettings, AudioFile, ActivityType, PlanningEvent, CallHistoryRecord, AgentSession, SystemLog, VersionInfo, ConnectivityService, BackupLog, BackupSchedule } from './types.ts';
import { features } from './data/features.ts';
import { mockData } from './data/mockData.ts';
import Sidebar from './components/Sidebar.tsx';
import LoginScreen from './components/LoginScreen.tsx';
import AgentView from './components/AgentView.tsx';
import FeatureDetail from './components/FeatureDetail.tsx';

// A simple deep copy function for state updates to avoid mutations
const deepCopy = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

const App: React.FC = () => {
    // --- STATE MANAGEMENT ---
    const [data, setData] = useState(mockData);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeFeatureId, setActiveFeatureId] = useState<FeatureId | null>(null);

    // Load module visibility from localStorage or use a default
    const [moduleVisibility, setModuleVisibility] = useState<ModuleVisibility>(() => {
        try {
            const saved = localStorage.getItem('moduleVisibility');
            return saved ? JSON.parse(saved) : { categories: {}, features: {} };
        } catch (error) {
            console.error("Failed to parse module visibility from localStorage", error);
            return { categories: {}, features: {} };
        }
    });

    // --- COMPUTED VALUES ---
    const activeFeature = useMemo(() => {
        if (!activeFeatureId) return null;
        return features.find(f => f.id === activeFeatureId) || null;
    }, [activeFeatureId]);
    
    // --- HANDLERS ---
    const handleLoginSuccess = (user: User) => {
        setCurrentUser(user);
        if (user.role === 'Agent') {
             setActiveFeatureId(null); // No default feature for agents, they see their view.
        } else {
            setActiveFeatureId('users'); // Default view for other roles
        }
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setActiveFeatureId(null);
    };
    
    const handleSaveVisibilitySettings = (visibility: ModuleVisibility) => {
        setModuleVisibility(visibility);
        localStorage.setItem('moduleVisibility', JSON.stringify(visibility));
    };

    const handleSaveUser = (user: User, groupIds: string[]) => {
        setData(prev => {
            const nextState = deepCopy(prev);
            const userExists = nextState.users.some(u => u.id === user.id);
            if (userExists) {
                nextState.users = nextState.users.map(u => u.id === user.id ? user : u);
            } else {
                nextState.users.push(user);
            }
            
            nextState.userGroups = nextState.userGroups.map(group => {
                const shouldHaveUser = groupIds.includes(group.id);
                const hasUser = group.memberIds.includes(user.id);
                if (shouldHaveUser && !hasUser) {
                    group.memberIds.push(user.id);
                } else if (!shouldHaveUser && hasUser) {
                    group.memberIds = group.memberIds.filter(id => id !== user.id);
                }
                return group;
            });

            return nextState;
        });
    };
    
     const handleGenerateUsers = (count: number) => {
        setData(prev => {
            const nextState = deepCopy(prev);
            const newUsers: User[] = [];
            const existingLoginIds = new Set(nextState.users.map(u => u.loginId));
            let startLoginId = 1000;
            
            for (let i = 0; i < count; i++) {
                while (existingLoginIds.has(String(startLoginId))) {
                    startLoginId++;
                }
                const newLoginId = String(startLoginId);
                const newUser: User = {
                    id: `user-gen-${Date.now() + i}`,
                    loginId: newLoginId,
                    firstName: `Agent`,
                    lastName: `${newLoginId}`,
                    email: `agent.${newLoginId}@example.com`,
                    role: 'Agent',
                    isActive: true,
                    campaignIds: [],
                    password: `${newLoginId}`,
                    siteId: nextState.sites[i % nextState.sites.length]?.id || null
                };
                newUsers.push(newUser);
                existingLoginIds.add(newLoginId);
            }
            nextState.users.push(...newUsers);
            return nextState;
        });
    };

    const handleDeleteUser = (userId: string) => {
        setData(prev => ({
            ...prev,
            users: prev.users.filter(u => u.id !== userId),
            userGroups: prev.userGroups.map(g => ({ ...g, memberIds: g.memberIds.filter(id => id !== userId) }))
        }));
    };
    
    const handleSaveUserGroup = (group: UserGroup) => {
        setData(prev => {
            const nextState = deepCopy(prev);
            const groupExists = nextState.userGroups.some(g => g.id === group.id);
            if (groupExists) {
                nextState.userGroups = nextState.userGroups.map(g => g.id === group.id ? group : g);
            } else {
                nextState.userGroups.push(group);
            }
            return nextState;
        });
    };

    const handleDeleteUserGroup = (groupId: string) => {
        setData(prev => ({ ...prev, userGroups: prev.userGroups.filter(g => g.id !== groupId) }));
    };

    const handleSaveScript = (script: SavedScript) => {
        setData(prev => {
            const nextState = deepCopy(prev);
            const scriptExists = nextState.savedScripts.some(s => s.id === script.id);
            if(scriptExists) {
                nextState.savedScripts = nextState.savedScripts.map(s => s.id === script.id ? script : s)
            } else {
                nextState.savedScripts.push(script);
            }
            return nextState;
        });
    };

    const handleDeleteScript = (scriptId: string) => {
        setData(prev => ({ ...prev, savedScripts: prev.savedScripts.filter(s => s.id !== scriptId) }));
    };

    const handleDuplicateScript = (scriptId: string) => {
        setData(prev => {
            const originalScript = prev.savedScripts.find(s => s.id === scriptId);
            if (!originalScript) return prev;
            const newScript = deepCopy(originalScript);
            newScript.id = `script-${Date.now()}`;
            newScript.name = `${originalScript.name} (Copie)`;
            return { ...prev, savedScripts: [...prev.savedScripts, newScript] };
        });
    };
    
    const handleSaveIvrFlow = (flow: IvrFlow) => {
        setData(prev => {
            const nextState = deepCopy(prev);
            const flowExists = nextState.savedIvrFlows.some(f => f.id === flow.id);
            if (flowExists) {
                 nextState.savedIvrFlows = nextState.savedIvrFlows.map(f => f.id === flow.id ? flow : f);
            } else {
                nextState.savedIvrFlows.push(flow);
            }
            return nextState;
        });
    };
    
    const handleDeleteIvrFlow = (flowId: string) => {
        setData(prev => ({ ...prev, savedIvrFlows: prev.savedIvrFlows.filter(f => f.id !== flowId) }));
    };
    
    const handleDuplicateIvrFlow = (flowId: string) => {
        setData(prev => {
            const originalFlow = prev.savedIvrFlows.find(f => f.id === flowId);
            if (!originalFlow) return prev;
            const newFlow = deepCopy(originalFlow);
            newFlow.id = `ivr-flow-${Date.now()}`;
            newFlow.name = `${originalFlow.name} (Copie)`;
            return { ...prev, savedIvrFlows: [...prev.savedIvrFlows, newFlow] };
        });
    };
    
     const handleSaveCampaign = (campaign: Campaign) => {
        setData(prev => {
            const nextState = deepCopy(prev);
            const campaignExists = nextState.campaigns.some(c => c.id === campaign.id);
            if (campaignExists) {
                nextState.campaigns = nextState.campaigns.map(c => c.id === campaign.id ? campaign : c);
            } else {
                nextState.campaigns.push(campaign);
            }
            return nextState;
        });
    };
    
    const handleDeleteCampaign = (campaignId: string) => {
        setData(prev => ({ ...prev, campaigns: prev.campaigns.filter(c => c.id !== campaignId) }));
    };
    
    const handleImportContacts = (campaignId: string, contacts: Contact[]) => {
        setData(prev => ({
            ...prev,
            campaigns: prev.campaigns.map(c => 
                c.id === campaignId 
                    ? { ...c, contacts: [...c.contacts, ...contacts] }
                    : c
            )
        }));
    };
    
     const handleSaveQualification = (qualification: Qualification) => {
        setData(prev => {
            const nextState = deepCopy(prev);
            const qualExists = nextState.qualifications.some(q => q.id === qualification.id);
            if (qualExists) {
                nextState.qualifications = nextState.qualifications.map(q => q.id === qualification.id ? qualification : q);
            } else {
                nextState.qualifications.push(qualification);
            }
            return nextState;
        });
    };

    const handleDeleteQualification = (qualId: string) => {
        setData(prev => {
            const nextState = deepCopy(prev);
            nextState.qualifications = nextState.qualifications.filter(q => q.id !== qualId);
            // Also un-parent children
            nextState.qualifications.forEach(q => {
                if(q.parentId === qualId) q.parentId = null;
            });
            return nextState;
        });
    };

    const handleSaveQualificationGroup = (group: QualificationGroup) => {
         setData(prev => {
            const nextState = deepCopy(prev);
            const groupExists = nextState.qualificationGroups.some(g => g.id === group.id);
            if(groupExists) {
                nextState.qualificationGroups = nextState.qualificationGroups.map(g => g.id === group.id ? group : g)
            } else {
                nextState.qualificationGroups.push(group)
            }
            return nextState;
        });
    };
    
    const handleDeleteQualificationGroup = (groupId: string) => {
         setData(prev => {
            const nextState = deepCopy(prev);
            nextState.qualificationGroups = nextState.qualificationGroups.filter(g => g.id !== groupId);
            // Unassign qualifications from this group
            nextState.qualifications.forEach(q => {
                if(q.groupId === groupId) q.groupId = null;
            });
            return nextState;
         });
    };
    
    const handleUpdateGroupQualifications = (groupId: string, assignedQualIds: string[]) => {
        setData(prev => ({
            ...prev,
            qualifications: prev.qualifications.map(q => {
                if(q.isStandard) return q;
                if(assignedQualIds.includes(q.id)) return { ...q, groupId };
                if(q.groupId === groupId) return { ...q, groupId: null };
                return q;
            })
        }));
    };
    
    const handleSaveSite = (site: Site) => {
        setData(prev => {
            const nextState = deepCopy(prev);
            const siteExists = nextState.sites.some(s => s.id === site.id);
            if (siteExists) {
                nextState.sites = nextState.sites.map(s => s.id === site.id ? site : s)
            } else {
                nextState.sites.push(site)
            }
            return nextState;
        });
    };
    
    const handleDeleteSite = (siteId: string) => {
        setData(prev => ({ ...prev, sites: prev.sites.filter(s => s.id !== siteId) }));
    };
    
    const handleSaveTrunk = (trunk: Trunk) => {
         setData(prev => {
            const nextState = deepCopy(prev);
            const trunkExists = nextState.trunks.some(t => t.id === trunk.id);
            if (trunkExists) {
                nextState.trunks = nextState.trunks.map(t => t.id === trunk.id ? trunk : t)
            } else {
                nextState.trunks.push(trunk)
            }
            return nextState;
        });
    };
    
    const handleDeleteTrunk = (trunkId: string) => {
        setData(prev => ({ ...prev, trunks: prev.trunks.filter(t => t.id !== trunkId) }));
    };
    
    const handleSaveDid = (did: Did) => {
         setData(prev => {
            const nextState = deepCopy(prev);
            const didExists = nextState.dids.some(d => d.id === did.id);
            if (didExists) {
                nextState.dids = nextState.dids.map(d => d.id === did.id ? did : d)
            } else {
                nextState.dids.push(did)
            }
            return nextState;
        });
    };
    
    const handleDeleteDid = (didId: string) => {
        setData(prev => ({ ...prev, dids: prev.dids.filter(d => d.id !== didId) }));
    };

    const handleSaveAudioFile = (file: AudioFile) => {
         setData(prev => {
            const nextState = deepCopy(prev);
            const fileExists = nextState.audioFiles.some(f => f.id === file.id);
            if (fileExists) {
                nextState.audioFiles = nextState.audioFiles.map(f => f.id === file.id ? file : f)
            } else {
                nextState.audioFiles.push(file)
            }
            return nextState;
        });
    };

    const handleDeleteAudioFile = (fileId: string) => {
        setData(prev => ({ ...prev, audioFiles: prev.audioFiles.filter(f => f.id !== fileId) }));
    };
    
    const handleSavePlanningEvent = (event: PlanningEvent) => {
         setData(prev => {
            const nextState = deepCopy(prev);
            const eventExists = nextState.planningEvents.some(e => e.id === event.id);
            if (eventExists) {
                nextState.planningEvents = nextState.planningEvents.map(e => e.id === event.id ? event : e)
            } else {
                nextState.planningEvents.push(event)
            }
            return nextState;
        });
    };
    
    const handleDeletePlanningEvent = (eventId: string) => {
        setData(prev => ({ ...prev, planningEvents: prev.planningEvents.filter(e => e.id !== eventId) }));
    };
    
    const handleSaveSystemConnectionSettings = (settings: SystemConnectionSettings) => {
        setData(prev => ({...prev, systemConnectionSettings: settings }));
    };


    // --- RENDER LOGIC ---
    if (!currentUser) {
        return <LoginScreen users={data.users} onLoginSuccess={handleLoginSuccess} />;
    }
    
    if (currentUser.role === 'Agent') {
        return <AgentView 
            agent={currentUser} 
            campaigns={data.campaigns} 
            savedScripts={data.savedScripts}
            sites={data.sites}
            personalCallbacks={data.personalCallbacks}
            qualifications={data.qualifications}
            qualificationGroups={data.qualificationGroups}
            onLogout={handleLogout}
        />;
    }

    const ActiveComponent = activeFeature?.component;

    // A map of handlers to avoid listing them all explicitly on each component
    const allHandlers = {
        onSaveUser: handleSaveUser,
        onDeleteUser: handleDeleteUser,
        onGenerateUsers: handleGenerateUsers,
        onSaveUserGroup: handleSaveUserGroup,
        onDeleteUserGroup: handleDeleteUserGroup,
        onSaveOrUpdateScript: handleSaveScript,
        onDeleteScript: handleDeleteScript,
        onDuplicateScript: handleDuplicateScript,
        onSaveOrUpdateIvrFlow: handleSaveIvrFlow,
        onDeleteIvrFlow: handleDeleteIvrFlow,
        onDuplicateIvrFlow: handleDuplicateIvrFlow,
        onSaveCampaign: handleSaveCampaign,
        onDeleteCampaign: handleDeleteCampaign,
        onImportContacts: handleImportContacts,
        onSaveQualification: handleSaveQualification,
        onDeleteQualification: handleDeleteQualification,
        onSaveQualificationGroup: handleSaveQualificationGroup,
        onDeleteQualificationGroup: handleDeleteQualificationGroup,
        onUpdateGroupQualifications: handleUpdateGroupQualifications,
        onSaveSite: handleSaveSite,
        onDeleteSite: handleDeleteSite,
        onSaveTrunk: handleSaveTrunk,
        onDeleteTrunk: handleDeleteTrunk,
        onSaveDid: handleSaveDid,
        onDeleteDid: handleDeleteDid,
        onSaveAudioFile: handleSaveAudioFile,
        onDeleteAudioFile: handleDeleteAudioFile,
        onSavePlanningEvent: handleSavePlanningEvent,
        onDeletePlanningEvent: handleDeletePlanningEvent,
        onSaveSystemConnectionSettings: handleSaveSystemConnectionSettings,
        onSaveVisibilitySettings: handleSaveVisibilitySettings,
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
                <div className="flex-1 overflow-y-auto p-8">
                    {ActiveComponent ? (
                        <ActiveComponent
                            feature={activeFeature}
                            // Pass all relevant data and handlers as props
                            {...data}
                            {...allHandlers}
                            currentUser={currentUser}
                        />
                    ) : (
                        <FeatureDetail feature={null} />
                    )}
                </div>
            </main>
        </div>
    );
};

export default App;
