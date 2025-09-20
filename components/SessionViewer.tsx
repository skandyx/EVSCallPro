import React, { useState, useMemo } from 'react';
import type { Feature, AgentSession, User } from '../types.ts';

const SessionViewer: React.FC<{
    feature: Feature;
    agentSessions: AgentSession[];
    users: User[];
}> = ({ feature, agentSessions, users }) => {
    const today = new Date().toISOString().split('T')[0];
    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
        searchTerm: '',
    });

    const formatDuration = (seconds: number) => {
        if(isNaN(seconds) || seconds < 0) return '00:00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.round(seconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const findEntityName = (id: string | null, collection: Array<{id: string, firstName?: string, lastName?: string}>): JSX.Element => {
        if (!id) return <span className="text-slate-400 italic">N/A</span>;
        const item = collection.find(i => i.id === id);
        if (!item) return <span className="text-red-500">Inconnu</span>;
        return <>{`${item.firstName} ${item.lastName}`}</>;
    };
    
    const findEntityNameAsString = (id: string | null, collection: Array<{id: string, firstName?: string, lastName?: string}>): string => {
        if (!id) return 'N/A';
        const item = collection.find(i => i.id === id);
        if (!item) return 'Inconnu';
        return `${item.firstName} ${item.lastName}`;
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const filteredSessions = useMemo(() => {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        const term = filters.searchTerm.toLowerCase();

        return agentSessions.filter(session => {
            const sessionDate = new Date(session.loginTime);
            if (sessionDate < start || sessionDate > end) return false;
            
            if (term) {
                const agentName = findEntityNameAsString(session.agentId, users).toLowerCase();
                if (!agentName.includes(term)) {
                    return false;
                }
            }
            return true;
        }).sort((a, b) => new Date(b.loginTime).getTime() - new Date(a.loginTime).getTime());
    }, [agentSessions, filters, users]);
    
    const getSessionDuration = (loginTime: string, logoutTime: string | null): number => {
        if (!logoutTime) return 0;
        const start = new Date(loginTime).getTime();
        const end = new Date(logoutTime).getTime();
        return (end - start) / 1000;
    };

    const dailySummary = useMemo(() => {
        const summary: { [agentId: string]: { name: JSX.Element; duration: number } } = {};
        filteredSessions.forEach(session => {
            if (!summary[session.agentId]) {
                summary[session.agentId] = {
                    name: findEntityName(session.agentId, users),
                    duration: 0,
                };
            }
            summary[session.agentId].duration += getSessionDuration(session.loginTime, session.logoutTime);
        });
        return Object.values(summary).sort((a, b) => b.duration - a.duration);
    }, [filteredSessions, users]);

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-4">
                    <div className="grid grid-cols-2 gap-2">
                         <div>
                            <label htmlFor="startDate" className="block text-sm font-medium text-slate-700">Du</label>
                            <input type="date" name="startDate" id="startDate" value={filters.startDate} onChange={handleFilterChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                        </div>
                        <div>
                            <label htmlFor="endDate" className="block text-sm font-medium text-slate-700">Au</label>
                            <input type="date" name="endDate" id="endDate" value={filters.endDate} onChange={handleFilterChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="searchTerm" className="block text-sm font-medium text-slate-700">Rechercher un agent</label>
                        <input type="text" name="searchTerm" id="searchTerm" value={filters.searchTerm} onChange={handleFilterChange} placeholder="Nom de l'agent..." className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <h2 className="text-xl font-semibold text-slate-800 mb-4">Détail des Sessions</h2>
                        <div className="overflow-x-auto h-[60vh] relative">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Agent</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Heure de Connexion</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Heure de Déconnexion</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Durée</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {filteredSessions.map(session => (
                                        <tr key={session.id}>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-800">{findEntityName(session.agentId, users)}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{new Date(session.loginTime).toLocaleDateString('fr-FR')}</td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-600">{new Date(session.loginTime).toLocaleTimeString('fr-FR')}</td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-600">{session.logoutTime ? new Date(session.logoutTime).toLocaleTimeString('fr-FR') : <span className="text-green-600 font-semibold">En cours</span>}</td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-800">{session.logoutTime ? formatDuration(getSessionDuration(session.loginTime, session.logoutTime)) : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredSessions.length === 0 && <p className="text-center py-8 text-slate-500">Aucun enregistrement de session trouvé pour les filtres sélectionnés.</p>}
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-800 mb-4">Total par agent</h2>
                        <div className="overflow-x-auto h-[60vh] relative">
                             <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Agent</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Temps total</th>
                                    </tr>
                                </thead>
                                 <tbody className="bg-white divide-y divide-slate-200">
                                    {dailySummary.map((summary, index) => (
                                        <tr key={index}>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-800">{summary.name}</td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-800">{formatDuration(summary.duration)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SessionViewer;