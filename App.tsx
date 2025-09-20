import React, { useState, useEffect } from 'react';
import { features } from './data/features.ts';
import { mockData } from './data/mockData.ts';
import type {
    Feature, FeatureId, User, UserRole, Campaign, UserGroup, SavedScript, IvrFlow,
    Contact, Qualification, QualificationGroup, Did, Trunk, Site, AudioFile,
    PlanningEvent, ActivityType, ModuleVisibility
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

const App: React.FC = () => {
    // --- STATE MANAGEMENT ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeFeatureId, setActiveFeatureId] = useState<FeatureId | null>(null);
    const [data, setData] = useState(mockData);

    const [moduleVisibility, setModuleVisibility] = useState<ModuleVisibility>(() => {
        const saved = localStorage.getItem('moduleVisibility');
        return saved ? JSON.parse(saved) : { categories: {}, features: {} };
    });
    
    // --- HANDLERS ---
    const handleLogin = (user: User) => {
        setCurrentUser(user);
        if (user.role === 'Agent') {
            // Agent view handled separately
        } else {
            setActiveFeatureId('supervision');
        }
    };
    const handleLogout = () => {
        setCurrentUser(null);
        setActiveFeatureId(null);
    };

    // --- DATA MUTATION HANDLERS (Simulating backend) ---
    const handleSaveUser = (user: User, groupIds: string[]) => {
        setData(prev => {
            const userIndex = prev.users.findIndex(u => u.id === user.id);
            const newUsers = [...prev.users];
            if (userIndex > -1) {
                newUsers[userIndex] = user;
            } else {
                newUsers.push(user);
            }
            const newGroups = prev.userGroups.map(g => ({
                ...g,
                memberIds: g.memberIds.filter(id => id !== user.id)
            }));
            groupIds.forEach(gid => {
                const group = newGroups.find(g => g.id === gid);
                if (group) group.memberIds.push(user.id);
            });
            return { ...prev, users: newUsers, userGroups: newGroups };
        });
    };
    const handleDeleteUser = (userId: string) => {
        setData(prev => ({
            ...prev,
            users: prev.users.filter(u => u.id !== userId),
            userGroups: prev.userGroups.map(g => ({...g, memberIds: g.memberIds.filter(id => id !== userId)}))
        }));
    };

    const handleSaveOrUpdateScript = (script: SavedScript) => {
        setData(prev => {
            const index = prev.savedScripts.findIndex(s => s.id === script.id);
            const newScripts = [...prev.savedScripts];
            if (index > -1) newScripts[index] = script;
            else newScripts.push(script);
            return { ...prev, savedScripts: newScripts };
        });
    };
    const handleDeleteScript = (scriptId: string) => setData(prev => ({...prev, savedScripts: prev.savedScripts.filter(s => s.id !== scriptId)}));
    const handleDuplicateScript = (scriptId: string) => {
        const scriptToCopy = data.savedScripts.find(s => s.id === scriptId);
        if (scriptToCopy) {
            const newScript = JSON.parse(JSON.stringify(scriptToCopy));
            newScript.id = `script-${Date.now()}`;
            newScript.name = `${newScript.name} (Copie)`;
            handleSaveOrUpdateScript(newScript);
        }
    };

    const handleSaveCampaign = (campaign: Campaign) => {
         setData(prev => {
            const index = prev.campaigns.findIndex(c => c.id === campaign.id);
            const newCampaigns = [...prev.campaigns];
            if (index > -1) newCampaigns[index] = campaign;
            else newCampaigns.push(campaign);
            return { ...prev, campaigns: newCampaigns };
        });
    };
    const handleDeleteCampaign = (campaignId: string) => setData(prev => ({ ...prev, campaigns: prev.campaigns.filter(c => c.id !== campaignId)}));
    const handleImportContacts = (campaignId: string, newContacts: Contact[]) => {
        setData(prev => {
            const newCampaigns = prev.campaigns.map(c => {
                if(c.id === campaignId) {
                    return {...c, contacts: [...c.contacts, ...newContacts]};
                }
                return c;
            });
            return {...prev, campaigns: newCampaigns};
        });
    };

    const handleSaveVisibilitySettings = (visibility: ModuleVisibility) => {
        setModuleVisibility(visibility);
        localStorage.setItem('moduleVisibility', JSON.stringify(visibility));
    };

    // --- RENDER LOGIC ---
    if (!currentUser) {
        return <LoginScreen users={data.users} onLoginSuccess={handleLogin} />;
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

    const activeFeature = features.find(f => f.id === activeFeatureId);
    
    const renderFeatureComponent = () => {
        if (!activeFeature) return <FeatureDetail feature={null} />;
        
        switch (activeFeature.id) {
            case 'users': return <UserManager feature={activeFeature} users={data.users} campaigns={data.campaigns} userGroups={data.userGroups} sites={data.sites} currentUser={currentUser} onSaveUser={handleSaveUser} onDeleteUser={handleDeleteUser} onGenerateUsers={() => {}} />;
            case 'groups': return <GroupManager feature={activeFeature} users={data.users} userGroups={data.userGroups} onSaveUserGroup={(g) => setData(prev => ({...prev, userGroups: prev.userGroups.find(ug => ug.id === g.id) ? prev.userGroups.map(ug => ug.id === g.id ? g : ug) : [...prev.userGroups, g]}))} onDeleteUserGroup={(id) => setData(prev => ({...prev, userGroups: prev.userGroups.filter(g => g.id !== id)}))} />;
            case 'scripts': return <ScriptFeature feature={activeFeature} savedScripts={data.savedScripts} onSaveOrUpdateScript={handleSaveOrUpdateScript} onDeleteScript={handleDeleteScript} onDuplicateScript={handleDuplicateScript} />;
            case 'ivr': return <IvrFeature feature={activeFeature} ivrFlows={data.savedIvrFlows} onSaveOrUpdateIvrFlow={(f) => setData(prev => ({...prev, savedIvrFlows: prev.savedIvrFlows.find(i => i.id === f.id) ? prev.savedIvrFlows.map(i => i.id === f.id ? f : i) : [...prev.savedIvrFlows, f]}))} onDeleteIvrFlow={(id) => setData(prev => ({...prev, savedIvrFlows: prev.savedIvrFlows.filter(i => i.id !== id)}))} onDuplicateIvrFlow={(id) => { const f = data.savedIvrFlows.find(i => i.id === id); if(f) setData(prev => ({...prev, savedIvrFlows: [...prev.savedIvrFlows, {...JSON.parse(JSON.stringify(f)), id: `ivr-${Date.now()}`, name: `${f.name} (Copie)`}]})) }}/>;
            case 'outbound': return <OutboundCampaignsManager feature={activeFeature} campaigns={data.campaigns} users={data.users} savedScripts={data.savedScripts} qualificationGroups={data.qualificationGroups} onSaveCampaign={handleSaveCampaign} onDeleteCampaign={handleDeleteCampaign} onImportContacts={handleImportContacts} />;
            case 'qualifications': return <QualificationsManager feature={activeFeature} qualifications={data.qualifications} qualificationGroups={data.qualificationGroups} onSaveQualification={(q) => setData(prev => ({...prev, qualifications: prev.qualifications.find(i => i.id === q.id) ? prev.qualifications.map(i => i.id === q.id ? q : i) : [...prev.qualifications, q]}))} onDeleteQualification={(id) => setData(prev => ({...prev, qualifications: prev.qualifications.filter(i => i.id !== id)}))} onSaveQualificationGroup={(g) => setData(prev => ({...prev, qualificationGroups: prev.qualificationGroups.find(i => i.id === g.id) ? prev.qualificationGroups.map(i => i.id === g.id ? g : i) : [...prev.qualificationGroups, g]}))} onDeleteQualificationGroup={(id) => setData(prev => ({...prev, qualificationGroups: prev.qualificationGroups.filter(i => i.id !== id)}))} onUpdateGroupQualifications={(groupId, qualIds) => setData(prev => ({...prev, qualifications: prev.qualifications.map(q => q.groupId === groupId ? {...q, groupId: null} : q).map(q => qualIds.includes(q.id) ? {...q, groupId} : q)}))} />;
            case 'trunks': return <TrunkManager feature={activeFeature} trunks={data.trunks} onSaveTrunk={(t) => setData(prev => ({...prev, trunks: prev.trunks.find(i=>i.id === t.id) ? prev.trunks.map(i=>i.id===t.id ? t : i) : [...prev.trunks, t]}))} onDeleteTrunk={(id) => setData(prev => ({...prev, trunks: prev.trunks.filter(i=>i.id!==id)}))} />;
            case 'dids': return <DidManager feature={activeFeature} dids={data.dids} trunks={data.trunks} ivrFlows={data.savedIvrFlows} onSaveDid={(d) => setData(prev => ({...prev, dids: prev.dids.find(i=>i.id===d.id) ? prev.dids.map(i=>i.id===d.id ? d : i) : [...prev.dids, d]}))} onDeleteDid={(id) => setData(prev => ({...prev, dids: prev.dids.filter(i=>i.id!==id)}))} />;
            case 'sites-config': return <SiteManager feature={activeFeature} sites={data.sites} onSaveSite={(s) => setData(prev => ({...prev, sites: prev.sites.find(i=>i.id===s.id) ? prev.sites.map(i=>i.id===s.id ? s : i) : [...prev.sites, s]}))} onDeleteSite={(id) => setData(prev => ({...prev, sites: prev.sites.filter(i=>i.id!==id)}))} />;
            case 'supervision': return <SupervisionDashboard feature={activeFeature} users={data.users} campaigns={data.campaigns} currentUser={currentUser} />;
            case 'reporting': return <ReportingDashboard feature={activeFeature} callHistory={data.callHistory} agentSessions={data.agentSessions} users={data.users} campaigns={data.campaigns} qualifications={data.qualifications} />;
            case 'history': return <HistoryViewer feature={activeFeature} callHistory={data.callHistory} users={data.users} campaigns={data.campaigns} qualifications={data.qualifications} />;
            case 'sessions': return <SessionViewer feature={activeFeature} agentSessions={data.agentSessions} users={data.users} />;
            case 'audio': return <AudioManager feature={activeFeature} audioFiles={data.audioFiles} onSaveAudioFile={(f) => setData(prev => ({...prev, audioFiles: prev.audioFiles.find(i=>i.id===f.id) ? prev.audioFiles.map(i=>i.id===f.id ? f : i) : [...prev.audioFiles, f]}))} onDeleteAudioFile={(id) => setData(prev => ({...prev, audioFiles: prev.audioFiles.filter(i=>i.id!==id)}))} />;
            case 'maintenance': return <MaintenanceManager feature={activeFeature} backupLogs={data.backupLogs} backupSchedule={data.backupSchedule} onSaveBackupSchedule={(s) => setData(prev => ({...prev, backupSchedule: s}))} onRunBackup={() => alert("Backup started!")} />;
            case 'planning': return <PlanningManager feature={activeFeature} planningEvents={data.planningEvents} activityTypes={data.activityTypes} users={data.users} userGroups={data.userGroups} onSavePlanningEvent={(e) => setData(prev => ({...prev, planningEvents: prev.planningEvents.find(i=>i.id===e.id) ? prev.planningEvents.map(i=>i.id===e.id ? e : i) : [...prev.planningEvents, e]}))} onDeletePlanningEvent={(id) => setData(prev => ({...prev, planningEvents: prev.planningEvents.filter(i=>i.id!==id)}))} />;
            case 'system-connection': return <SystemConnectionManager feature={activeFeature} systemConnectionSettings={data.systemConnectionSettings} onSaveSystemConnectionSettings={(s) => setData(prev => ({...prev, systemConnectionSettings: s}))} />;
            case 'module-settings': return <ModuleSettingsManager feature={activeFeature} features={features} moduleVisibility={moduleVisibility} onSaveVisibilitySettings={handleSaveVisibilitySettings} />;
            case 'api-docs': return <ApiDocs feature={activeFeature} />;
            case 'help': return <HelpCenter feature={activeFeature} />;
            
            // Default case if a component is not specified for a feature
            default: return <FeatureDetail feature={activeFeature} />;
        }
    };
    
    return (
        <div className="h-screen w-screen flex bg-slate-100 font-sans">
            <Sidebar
                features={features}
                activeFeatureId={activeFeatureId}
                onSelectFeature={(id: FeatureId) => setActiveFeatureId(id)}
                currentUser={currentUser}
                onLogout={handleLogout}
                moduleVisibility={moduleVisibility}
            />
            <main className="flex-1 flex flex-col overflow-hidden">
                 <div className="flex-1 p-8 overflow-y-auto">
                    {renderFeatureComponent()}
                 </div>
            </main>
        </div>
    );
};

export default App;
