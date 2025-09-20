import React, { useState, useMemo } from 'react';
import type { Feature, CallHistoryRecord, User, Campaign, Qualification } from '../types.ts';

const HistoryViewer: React.FC<{
    feature: Feature;
    callHistory: CallHistoryRecord[];
    users: User[];
    campaigns: Campaign[];
    qualifications: Qualification[];
}> = ({ feature, callHistory, users, campaigns, qualifications }) => {
    const today = new Date().toISOString().split('T')[0];
    const [filters, setFilters] = useState({
        direction: 'all',
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

    const findEntityName = (id: string | null, collection: Array<{id: string, name?: string, firstName?: string, lastName?: string, description?: string}>, returnString: boolean = false): string | JSX.Element => {
        if (!id) return returnString ? 'N/A' : <span className="text-slate-400 italic">N/A</span>;
        const item = collection.find(i => i.id === id);
        if (!item) return returnString ? 'Inconnu' : <span className="text-red-500">Inconnu</span>;
        const name = item.name || `${item.firstName} ${item.lastName}` || item.description;
        return returnString ? name || '' : <>{name}</>;
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const filteredCalls = useMemo(() => {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        const term = filters.searchTerm.toLowerCase();

        return callHistory.filter(call => {
            const callDate = new Date(call.timestamp);
            if (callDate < start || callDate > end) return false;
            
            if (filters.direction !== 'all' && call.direction !== filters.direction) return false;
            
            if (term) {
                const agentName = (findEntityName(call.agentId, users, true) as string).toLowerCase();
                const campaignName = (findEntityName(call.campaignId, campaigns, true) as string).toLowerCase();
                if (
                    !call.callerNumber.toLowerCase().includes(term) &&
                    !agentName.includes(term) &&
                    !campaignName.includes(term)
                ) {
                    return false;
                }
            }
            return true;
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [callHistory, filters, users, campaigns]);

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
                    <div>
                        <label htmlFor="direction" className="block text-sm font-medium text-slate-700">Direction</label>
                        <select id="direction" name="direction" value={filters.direction} onChange={handleFilterChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-md bg-white">
                            <option value="all">Toutes</option>
                            <option value="inbound">Entrant</option>
                            <option value="outbound">Sortant</option>
                        </select>
                    </div>
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
                        <label htmlFor="searchTerm" className="block text-sm font-medium text-slate-700">Rechercher</label>
                        <input type="text" name="searchTerm" id="searchTerm" value={filters.searchTerm} onChange={handleFilterChange} placeholder="Numéro, agent, campagne..." className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                    </div>
                </div>
                
                <h2 className="text-2xl font-semibold text-slate-800 mb-4 mt-6 border-b pb-2">Historique des Appels</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date & Heure</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Direction</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Numéro</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Agent</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Campagne</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Durée</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Qualification</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {filteredCalls.map(call => (
                                <tr key={call.id}>
                                    <td className="px-6 py-4 text-sm text-slate-600">{new Date(call.timestamp).toLocaleString('fr-FR')}</td>
                                    <td className="px-6 py-4 text-sm capitalize">{call.direction === 'inbound' ? 'Entrant' : 'Sortant'}</td>
                                    <td className="px-6 py-4 text-sm font-mono text-slate-800">{call.callerNumber}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">{findEntityName(call.agentId, users)}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{findEntityName(call.campaignId, campaigns)}</td>
                                    <td className="px-6 py-4 text-sm font-mono text-slate-600">{formatDuration(call.duration)}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{findEntityName(call.qualificationId, qualifications)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredCalls.length === 0 && <p className="text-center py-8 text-slate-500">Aucun enregistrement d'appel trouvé pour les filtres sélectionnés.</p>}
                </div>
            </div>
        </div>
    );
};

export default HistoryViewer;