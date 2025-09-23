

import React, { useState, useEffect, useMemo } from 'react';
// FIX: Changed type from (typeof mockData.campaigns) to Campaign[] to remove dependency on non-existent mockData file.
import type { Feature, AgentState, ActiveCall, CampaignState, User, Campaign } from '../types.ts';
import AgentBoard from './AgentBoard.tsx';
import CallBoard from './CallBoard.tsx';
import CampaignBoard from './CampaignBoard.tsx';
import { UsersIcon, PhoneIcon, ChartBarIcon } from './Icons.tsx';

interface SupervisionDashboardProps {
    feature: Feature;
    users: User[];
    campaigns: Campaign[];
    currentUser: User | null;
}

type Tab = 'live' | 'agents' | 'calls' | 'campaigns';

// Simulate live data updates
const useLiveData = (initialAgents: User[], initialCampaigns: Campaign[]) => {
    const agentStates = useMemo<AgentState[]>(() => {
        return initialAgents
            .filter(u => u.role === 'Agent')
            .map(agent => ({
                ...agent,
                status: 'En Attente',
                statusDuration: 0,
                callsHandledToday: 0,
                averageHandlingTime: 0,
            }));
    }, [initialAgents]);

    const [liveAgentStates, setLiveAgentStates] = useState<AgentState[]>(agentStates);
    const [liveCalls, setLiveCalls] = useState<ActiveCall[]>([]);
    const [liveCampaigns, setLiveCampaigns] = useState<CampaignState[]>(
        initialCampaigns.map(c => ({
            id: c.id,
            name: c.name,
            status: c.isActive ? 'running' : 'stopped',
            offered: 0,
            answered: 0,
            hitRate: 0,
            agentsOnCampaign: 0,
        }))
    );

    useEffect(() => {
        const interval = setInterval(() => {
            setLiveAgentStates(prevStates =>
                prevStates.map(agent => {
                    const newState = { ...agent, statusDuration: agent.statusDuration + 2 };
                    if (Math.random() < 0.05) {
                        const statuses: AgentState['status'][] = ['En Attente', 'En Appel', 'En Post-Appel', 'En Pause'];
                        newState.status = statuses[Math.floor(Math.random() * statuses.length)];
                        newState.statusDuration = 0;
                    }
                    return newState;
                })
            );

            // Simulate call changes
            if (Math.random() < 0.2 && liveCalls.length > 0) {
                 setLiveCalls(prev => prev.slice(1));
            }
             if (Math.random() < 0.1 && liveAgentStates.some(a => a.status === 'En Attente')) {
                const availableAgent = liveAgentStates.find(a => a.status === 'En Attente');
                const campaign = initialCampaigns[Math.floor(Math.random() * initialCampaigns.length)];
                if(availableAgent && campaign) {
                    const newCall: ActiveCall = {
                        id: `call-${Date.now()}`,
                        from: `06${Math.floor(10000000 + Math.random() * 90000000)}`,
                        to: campaign.callerId,
                        agentId: availableAgent.id,
                        campaignId: campaign.id,
                        duration: 0,
                        status: 'active',
                    };
                    setLiveCalls(prev => [...prev, newCall]);
                }
            }
            setLiveCalls(prev => prev.map(c => ({...c, duration: c.duration + 2})));

        }, 2000);

        return () => clearInterval(interval);
    }, [liveAgentStates, liveCalls.length, initialCampaigns]);

    return { liveAgentStates, liveCalls, liveCampaigns };
};

const KpiCard: React.FC<{ title: string; value: string | number; icon: React.FC<any> }> = ({ title, value, icon: Icon }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center">
            <div className="p-3 bg-indigo-100 rounded-full mr-4">
                <Icon className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
                <p className="text-sm text-slate-500">{title}</p>
                <p className="text-3xl font-bold text-slate-900">{value}</p>
            </div>
        </div>
    </div>
);

const SupervisionDashboard: React.FC<SupervisionDashboardProps> = ({ feature, users, campaigns, currentUser }) => {
    const [activeTab, setActiveTab] = useState<Tab>('live');
    const { liveAgentStates, liveCalls, liveCampaigns } = useLiveData(users, campaigns);
    
    if (!currentUser) return null;

    const liveKpis = {
        agentsReady: liveAgentStates.filter(a => a.status === 'En Attente').length,
        agentsOnCall: liveAgentStates.filter(a => a.status === 'En Appel').length,
        agentsOnWrapup: liveAgentStates.filter(a => a.status === 'En Post-Appel').length,
        agentsOnPause: liveAgentStates.filter(a => a.status === 'En Pause').length,
        activeCalls: liveCalls.length,
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'live':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <KpiCard title="Agents en Attente" value={liveKpis.agentsReady} icon={UsersIcon} />
                        <KpiCard title="Agents en Appel" value={liveKpis.agentsOnCall} icon={PhoneIcon} />
                        <KpiCard title="Agents en Post-Appel" value={liveKpis.agentsOnWrapup} icon={UsersIcon} />
                        <KpiCard title="Agents en Pause" value={liveKpis.agentsOnPause} icon={UsersIcon} />
                        <KpiCard title="Appels Actifs" value={liveKpis.activeCalls} icon={ChartBarIcon} />
                    </div>
                );
            case 'agents':
                return <AgentBoard agents={liveAgentStates} currentUser={currentUser} />;
            case 'calls':
                return <CallBoard calls={liveCalls} agents={users} campaigns={campaigns} />;
            case 'campaigns':
                return <CampaignBoard campaignStates={liveCampaigns} />;
            default:
                return null;
        }
    };
    
    const TabButton: React.FC<{ tabName: Tab; label: string; }> = ({ tabName, label }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-4 py-2 text-sm font-semibold rounded-md ${activeTab === tabName ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                 <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <h2 className="text-2xl font-semibold text-slate-800">Panneau de Contrôle</h2>
                    <div className="flex space-x-2 p-1 bg-slate-100 rounded-lg">
                        <TabButton tabName="live" label="Live" />
                        <TabButton tabName="agents" label="Agents" />
                        <TabButton tabName="calls" label="Appels" />
                        <TabButton tabName="campaigns" label="Campagnes" />
                    </div>
                </div>
                {renderContent()}
            </div>
        </div>
    );
};

export default SupervisionDashboard;
