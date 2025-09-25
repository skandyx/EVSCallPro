import React, { useState } from 'react';
import type { Feature, BackupLog, BackupSchedule } from '../types.ts';
import { PlusIcon, TrashIcon, CheckIcon, XMarkIcon, InformationCircleIcon } from './Icons.tsx';

interface MaintenanceManagerProps {
    feature: Feature;
    backupLogs: BackupLog[];
    backupSchedule: BackupSchedule;
    onSaveBackupSchedule: (schedule: BackupSchedule) => void;
    onRunBackup: () => void;
}

const MaintenanceManager: React.FC<MaintenanceManagerProps> = ({ feature, backupLogs, backupSchedule, onSaveBackupSchedule, onRunBackup }) => {
    const [schedule, setSchedule] = useState<BackupSchedule>(backupSchedule);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleScheduleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setSchedule(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSaveSchedule = () => {
        setIsSaving(true);
        setShowSuccess(false);
        setTimeout(() => {
            onSaveBackupSchedule(schedule);
            setIsSaving(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
        }, 1000);
    };

    // Fix: Added a return statement with JSX to render the component's UI.
    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-2xl font-semibold text-slate-800 mb-4">Planification</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Fréquence</label>
                            <select name="frequency" value={schedule.frequency} onChange={handleScheduleChange} className="mt-1 block w-full p-2 border bg-white border-slate-300 rounded-md">
                                <option value="none">Aucune</option>
                                <option value="daily">Quotidienne</option>
                                <option value="weekly">Hebdomadaire</option>
                            </select>
                        </div>
                        {schedule.frequency !== 'none' && (
                             <div>
                                <label className="block text-sm font-medium text-slate-700">Heure de la sauvegarde</label>
                                <input type="time" name="time" value={schedule.time} onChange={handleScheduleChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                            </div>
                        )}
                    </div>
                    <div className="mt-6 flex items-center justify-end gap-4">
                        {showSuccess && <span className="text-sm text-green-600">Enregistré !</span>}
                        <button onClick={handleSaveSchedule} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md disabled:opacity-50">
                            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-semibold text-slate-800">Historique des sauvegardes</h2>
                        <button onClick={onRunBackup} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg shadow-sm inline-flex items-center">
                            <PlusIcon className="w-5 h-5 mr-2" />
                            Lancer maintenant
                        </button>
                    </div>
                    <div className="overflow-x-auto h-72">
                         <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date & Heure</th>
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
                                                {log.status === 'success' ? 'Succès' : 'Échec'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-mono text-slate-800">{log.fileName}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {backupLogs.length === 0 && <p className="text-center py-8 text-slate-500">Aucune sauvegarde n'a été effectuée.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Fix: Added default export to make the component importable.
export default MaintenanceManager;
