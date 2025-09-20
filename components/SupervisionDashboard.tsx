import React, { useState, useEffect, useMemo } from 'react';
import type { Feature, User, Campaign, AgentState, ActiveCall, CampaignState, AgentStatus } from '../types.ts';
import { UsersIcon, PhoneIcon, ChartBarIcon, BellAlertIcon } from './Icons.tsx';
import AgentBoard from './AgentBoard.tsx';
import CallBoard from './CallBoard.tsx';
import CampaignBoard from './CampaignBoard.tsx';

interface SupervisionDashboardProps {
    feature: Feature;
    users: User[];
    campaigns: Campaign[];
    currentUser: User;
}

const STATUS_CONFIG: { [key in AgentStatus]: { label: string; color: string } } = {
    'En Attente': { label: 'En Attente', color: 'bg-green-500' },
    'En Appel': { label: 'En Appel', color: 'bg-red-500' },
    'En Post-Appel': { label: 'En Post-Appel', color: 'bg-yellow-500' },
    'En Pause': { label: 'En Pause', color: 'bg-slate-500' },
};

const SupervisionDashboard: React.FC<SupervisionDashboardProps> = ({ feature, users, campaigns, currentUser }) => {
    const [activeTab, setActiveTab] = useState<'live' | 'agents' | 'calls' | 'campaigns'>('live');
    
    // Live Data State
    const [agentStates, setAgentStates] = useState<AgentState[]>([]);
    const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
    const [campaignStates, setCampaignStates] = useState<CampaignState[]>([]);

    const agents = useMemo(() => users.filter(u => u.role === 'Agent'), [users]);

    // WebSocket Simulation Effect
    useEffect(() => {
        // Initial state generation
        setAgentStates(
            agents.map(agent => ({
                ...agent,
                status: 'En Attente',
                statusDuration: Math.floor(Math.random() * 600),
                callsHandledToday: Math.floor(Math.random() * 50),
                averageHandlingTime: Math.floor(Math.random() * 120) + 180, // 3 to 5 minutes
            }))
        );
        setCampaignStates(
            campaigns.map(c => ({
                id: c.id,
                name: c.name,
                status: c.isActive ? 'running' : 'stopped',
                offered: Math.floor(Math.random() * 200) + 50,
                answered: Math.floor(Math.random() * 150) + 40,
                hitRate: Math.random() * 20 + 10,
                agentsOnCampaign: agents.filter(a => a.campaignIds.includes(c.id)).length,
            }))
        );

        const timer = setInterval(() => {
            // Update agent states
            setAgentStates(prevStates =>
                prevStates.map(agent => {
                    let newStatus = agent.status;
                    let newDuration = agent.statusDuration + 2; // Tick every 2s
                    // Random state changes
                    if (Math.random() < 0.05) {
                        const statuses: AgentStatus[] = ['En Attente', 'En Appel', 'En Post-Appel', 'En Pause'];
                        newStatus = statuses[Math.floor(Math.random() * statuses.length)];
                        newDuration = 0;
                    }
                    return { ...agent, status: newStatus, statusDuration: newDuration };
                })
            );
            
            // Update active calls
            setActiveCalls(prevCalls => {
                let newCalls = [...prevCalls];
                // End some calls
                newCalls = newCalls.filter(() => Math.random() > 0.1);
                // Add a new call
                if (Math.random() > 0.6) {
                    const availableAgents = agentStates.filter(a => a.status === 'En Attente');
                    if(availableAgents.length > 0) {
                        const agent = availableAgents[Math.floor(Math.random() * availableAgents.length)];
                        const campaign = campaigns.find(c => agent.campaignIds.includes(c.id));
                        newCalls.push({
                            id: `call-${Date.now()}`,
                            from: `06${Math.floor(Math.random() * 100000000)}`,
                            to: campaign?.callerId || 'N/A',
                            agentId: agent.id,
                            campaignId: campaign?.id || 'N/A',
                            duration: 0,
                            status: 'active',
                        });
                    }
                }
                return newCalls.map(call => ({...call, duration: call.duration + 2}));
            });
            
            // Update campaign states
            setCampaignStates(prev => prev.map(cs => ({
                ...cs,
                offered: cs.status === 'running' ? cs.offered + (Math.random() > 0.5 ? 1 : 0) : cs.offered,
                answered: cs.status === 'running' ? cs.answered + (Math.random() > 0.7 ? 1 : 0) : cs.answered,
            })));

        }, 2000); // Update every 2 seconds

        return () => clearInterval(timer);
    }, [users, campaigns, agents]);
    
    const kpis = useMemo(() => {
        const agentsReady = agentStates.filter(a => a.status === 'En Attente').length;
        const agentsOnCall = agentStates.filter(a => a.status === 'En Appel').length;
        const agentsInWrapUp = agentStates.filter(a => a.status === 'En Post-Appel').length;
        const agentsInPause = agentStates.filter(a => a.status === 'En Pause').length;
        
        const longestWait = activeCalls.length > 0 
            ? Math.max(...activeCalls.map(c => c.duration))
            : 0;

        return { agentsReady, agentsOnCall, agentsInWrapUp, agentsInPause, longestWait };
    }, [agentStates, activeCalls]);

    const TabButton: React.FC<{text: string, tabName: 'live' | 'agents' | 'calls' | 'campaigns'}> = ({ text, tabName }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === tabName ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
            {text}
        </button>
    );

    const LiveDashboard = () => (
         <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Agents en Attente" value={kpis.agentsReady} color="text-green-600" />
                <KpiCard title="Agents en Appel" value={kpis.agentsOnCall} color="text-red-600" />
                <KpiCard title="Agents en Post-Appel" value={kpis.agentsInWrapUp} color="text-yellow-600" />
                <KpiCard title="Agents en Pause" value={kpis.agentsInPause} color="text-slate-600" />
            </div>
            <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 col-span-1 md:col-span-2">
                 <h3 className="text-lg font-semibold text-slate-800 mb-2">Alertes Intelligentes</h3>
                 <div className="space-y-3">
                     <div className="flex items-start p-2 bg-amber-50 rounded-md">
                        <BellAlertIcon className="w-5 h-5 text-amber-500 mr-3 mt-0.5 flex-shrink-0"/>
                        <p className="text-sm text-amber-800"><span className="font-semibold">Info :</span> L'agent 'Alice Agent' a un Temps Moyen de Conversation 30% plus élevé que la moyenne aujourd'hui.</p>
                     </div>
                     <div className="flex items-start p-2 bg-red-50 rounded-md">
                        <BellAlertIcon className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0"/>
                        <p className="text-sm text-red-800"><span className="font-semibold">Alerte :</span> Le Taux d'Occupation est tombé à 65% sur les 30 dernières minutes.</p>
                     </div>
                 </div>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'live':
                return <LiveDashboard />;
            case 'agents':
                return <AgentBoard agents={agentStates} currentUser={currentUser} />;
            case 'calls':
                return <CallBoard calls={activeCalls} agents={users} campaigns={campaigns} />;
            case 'campaigns':
                return <CampaignBoard campaignStates={campaignStates} />;
            default:
                return null;
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 font-sans">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="border-b border-slate-200">
                    <nav className="-mb-px flex space-x-4 px-4">
                        <TabButton text="Live" tabName="live" />
                        <TabButton text="Agents" tabName="agents" />
                        <TabButton text="Appels" tabName="calls" />
                        <TabButton text="Campagnes" tabName="campaigns" />
                    </nav>
                </div>
                <div className="p-4">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

const KpiCard: React.FC<{title: string, value: number, color: string}> = ({ title, value, color }) => (
    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        <p className={`text-4xl font-bold ${color}`}>{value}</p>
    </div>
);


export default SupervisionDashboard;