import React, { useState } from 'react';
import type { Feature, BackupLog, BackupSchedule } from '../types.ts';
import { DatabaseIcon } from './Icons.tsx';

interface MaintenanceManagerProps {
    feature: Feature;
    backupLogs: BackupLog[];
    backupSchedule: BackupSchedule;
    onManualBackup: () => void;
    onUpdateSchedule: (schedule: BackupSchedule) => void;
}

const MaintenanceManager: React.FC<MaintenanceManagerProps> = ({
    feature,
    backupLogs,
    backupSchedule,
    onManualBackup,
    onUpdateSchedule
}) => {
    const [schedule, setSchedule] = useState<BackupSchedule>(backupSchedule);
    const [isLoading, setIsLoading] = useState(false);

    const handleScheduleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        const newSchedule = { ...schedule, [name]: value };
        setSchedule(newSchedule);
        onUpdateSchedule(newSchedule);
    };

    const handleBackupClick = () => {
        setIsLoading(true);
        // Simulate backup process
        setTimeout(() => {
            onManualBackup();
            setIsLoading(false);
        }, 1500);
    };

    const lastBackup = backupLogs.length > 0 ? backupLogs[0] : null;

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Manual Backup & Status */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-2xl font-semibold text-slate-800 mb-4">Sauvegarde Manuelle</h2>
                    <p className="text-sm text-slate-600 mb-4">
                        Lancez une sauvegarde instantanée de toute la configuration de l'application. Le fichier téléchargé contiendra tous vos scripts, SVI, utilisateurs, etc.
                    </p>
                    <button
                        onClick={handleBackupClick}
                        disabled={isLoading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-md inline-flex items-center justify-center disabled:bg-indigo-400 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Sauvegarde en cours...
                            </>
                        ) : (
                            <>
                                <DatabaseIcon className="w-5 h-5 mr-2" />
                                Lancer une sauvegarde maintenant
                            </>
                        )}
                    </button>
                    {lastBackup && (
                        <div className={`mt-4 p-3 rounded-md text-sm ${lastBackup.status === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                            <strong>Dernière sauvegarde :</strong> {new Date(lastBackup.timestamp).toLocaleString('fr-FR')} -
                            <span className="font-semibold"> {lastBackup.status === 'success' ? 'Réussie' : 'Échouée'}</span>
                        </div>
                    )}
                </div>

                {/* Scheduling */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                     <h2 className="text-2xl font-semibold text-slate-800 mb-4">Planification</h2>
                     <p className="text-sm text-slate-600 mb-4">
                        Configurez des sauvegardes automatiques pour garantir la sécurité de vos données sans y penser.
                    </p>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="frequency" className="block text-sm font-medium text-slate-700">Fréquence</label>
                            <select
                                id="frequency"
                                name="frequency"
                                value={schedule.frequency}
                                onChange={handleScheduleChange}
                                className="mt-1 block w-full p-2 border border-slate-300 rounded-md bg-white"
                            >
                                <option value="none">Jamais</option>
                                <option value="daily">Quotidienne</option>
                                <option value="weekly">Hebdomadaire</option>
                            </select>
                        </div>
                         {schedule.frequency === 'daily' && (
                            <div>
                                <label htmlFor="time" className="block text-sm font-medium text-slate-700">Heure de la sauvegarde</label>
                                <input
                                    type="time"
                                    id="time"
                                    name="time"
                                    value={schedule.time}
                                    onChange={handleScheduleChange}
                                    className="mt-1 block w-full p-2 border border-slate-300 rounded-md"
                                />
                            </div>
                         )}
                    </div>
                </div>
            </div>

            {/* History */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-2xl font-semibold text-slate-800 mb-4">Historique des Sauvegardes</h2>
                <div className="overflow-x-auto max-h-96">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fichier</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {backupLogs.map(log => (
                                <tr key={log.id}>
                                    <td className="px-6 py-4 text-sm text-slate-600">{new Date(log.timestamp).toLocaleString('fr-FR')}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {log.status === 'success' ? 'Réussie' : 'Échouée'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500 font-mono">{log.fileName}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {backupLogs.length === 0 && (
                        <p className="text-center py-8 text-slate-500">Aucune sauvegarde n'a encore été effectuée.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MaintenanceManager;
