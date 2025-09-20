import React, { useState } from 'react';
import type { Feature, BackupLog, BackupSchedule } from '../types.ts';
import { CheckIcon, XMarkIcon } from './Icons.tsx';

interface MaintenanceManagerProps {
    feature: Feature;
    backupLogs: BackupLog[];
    backupSchedule: BackupSchedule;
    // Handlers for interaction, to be implemented in App.tsx if needed
    // onRunBackup: () => void;
    // onSaveSchedule: (schedule: BackupSchedule) => void;
}

const MaintenanceManager: React.FC<MaintenanceManagerProps> = ({ feature, backupLogs, backupSchedule }) => {
    const [schedule, setSchedule] = useState<BackupSchedule>(backupSchedule);
    const [isSaving, setIsSaving] = useState(false);

    const handleRunBackup = () => {
        alert("Simulation: Lancement d'une sauvegarde manuelle...");
        // In a real app, you would call a prop like onRunBackup()
    };
    
    const handleSaveSchedule = () => {
        setIsSaving(true);
        setTimeout(() => {
            alert("Simulation: Planification de sauvegarde enregistrée.");
            // In a real app, you would call a prop like onSaveSchedule(schedule)
            setIsSaving(false);
        }, 1000);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-2xl font-semibold text-slate-800 mb-4">Sauvegarde Manuelle</h2>
                    <p className="text-sm text-slate-600 mb-4">
                        Lancez une sauvegarde complète de la configuration de l'application à tout moment. Utile avant des modifications importantes.
                    </p>
                    <button
                        onClick={handleRunBackup}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors"
                    >
                        Lancer une sauvegarde maintenant
                    </button>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-2xl font-semibold text-slate-800 mb-4">Planification</h2>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="frequency" className="block text-sm font-medium text-slate-700">Fréquence</label>
                            <select
                                id="frequency"
                                value={schedule.frequency}
                                onChange={e => setSchedule(s => ({ ...s, frequency: e.target.value as 'none' | 'daily' | 'weekly' }))}
                                className="mt-1 block w-full p-2 border bg-white border-slate-300 rounded-md"
                            >
                                <option value="none">Aucune</option>
                                <option value="daily">Quotidienne</option>
                                <option value="weekly">Hebdomadaire</option>
                            </select>
                        </div>
                         <div>
                            <label htmlFor="time" className="block text-sm font-medium text-slate-700">Heure (UTC)</label>
                            <input
                                type="time"
                                id="time"
                                value={schedule.time}
                                onChange={e => setSchedule(s => ({ ...s, time: e.target.value }))}
                                disabled={schedule.frequency === 'none'}
                                className="mt-1 block w-full p-2 border border-slate-300 rounded-md disabled:bg-slate-100"
                            />
                        </div>
                    </div>
                     <button
                        onClick={handleSaveSchedule}
                        disabled={isSaving}
                        className="mt-4 w-full bg-slate-700 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors disabled:bg-slate-400"
                    >
                        {isSaving ? 'Enregistrement...' : 'Enregistrer la planification'}
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-2xl font-semibold text-slate-800 mb-4">Historique des Sauvegardes</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date & Heure</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nom du Fichier</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {backupLogs.map(log => (
                                <tr key={log.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{new Date(log.timestamp).toLocaleString('fr-FR')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-800">{log.fileName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {log.status === 'success' ? (
                                            <span className="flex items-center text-green-700 font-semibold">
                                                <CheckIcon className="w-4 h-4 mr-2 text-green-500"/>
                                                Réussie
                                            </span>
                                        ) : (
                                            <span className="flex items-center text-red-700 font-semibold">
                                                <XMarkIcon className="w-4 h-4 mr-2 text-red-500"/>
                                                Échouée
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MaintenanceManager;
