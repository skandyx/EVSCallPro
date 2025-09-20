import React, { useState } from 'react';
import type { Feature, SystemConnectionSettings } from '../types.ts';
import { DatabaseIcon, ServerStackIcon, CheckIcon, XMarkIcon } from './Icons.tsx';

interface SystemConnectionManagerProps {
    feature: Feature;
    systemConnectionSettings: SystemConnectionSettings;
    onSaveSystemConnectionSettings: (settings: SystemConnectionSettings) => void;
}

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'failure';

const ConnectionStatusIndicator: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
    switch (status) {
        case 'testing':
            return <span className="text-sm font-semibold text-yellow-600">Test en cours...</span>;
        case 'success':
            return <span className="flex items-center text-sm font-semibold text-green-600"><CheckIcon className="w-4 h-4 mr-1"/>Connecté</span>;
        case 'failure':
            return <span className="flex items-center text-sm font-semibold text-red-600"><XMarkIcon className="w-4 h-4 mr-1"/>Échec</span>;
        default:
            return null;
    }
};

const SystemConnectionManager: React.FC<SystemConnectionManagerProps> = ({ feature, systemConnectionSettings, onSaveSystemConnectionSettings }) => {
    const [settings, setSettings] = useState<SystemConnectionSettings>(systemConnectionSettings);
    const [dbStatus, setDbStatus] = useState<ConnectionStatus>('idle');
    const [amiStatus, setAmiStatus] = useState<ConnectionStatus>('idle');
    const [isDirty, setIsDirty] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleChange = (section: 'database' | 'asterisk', field: string, value: string | number) => {
        setSettings(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
        setIsDirty(true);
    };

    const testDbConnection = () => {
        setDbStatus('testing');
        setTimeout(() => {
            // Simulate success/failure
            const success = Math.random() > 0.2;
            setDbStatus(success ? 'success' : 'failure');
        }, 1500);
    };

    const testAmiConnection = () => {
        setAmiStatus('testing');
        setTimeout(() => {
            const success = Math.random() > 0.2;
            setAmiStatus(success ? 'success' : 'failure');
        }, 1500);
    };

    const handleSave = () => {
        onSaveSystemConnectionSettings(settings);
        setIsDirty(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2500);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>

            <div className="space-y-6">
                {/* Database Configuration */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-2xl font-semibold text-slate-800 mb-4 flex items-center"><DatabaseIcon className="w-6 h-6 mr-3 text-indigo-600"/> Base de Données (PostgreSQL)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Hôte</label>
                            <input type="text" value={settings.database.host} onChange={e => handleChange('database', 'host', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Port</label>
                            <input type="number" value={settings.database.port} onChange={e => handleChange('database', 'port', parseInt(e.target.value))} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Nom de la base</label>
                            <input type="text" value={settings.database.database} onChange={e => handleChange('database', 'database', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Utilisateur</label>
                            <input type="text" value={settings.database.user} onChange={e => handleChange('database', 'user', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Mot de passe</label>
                            <input type="password" value={settings.database.password} onChange={e => handleChange('database', 'password', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-4">
                        <ConnectionStatusIndicator status={dbStatus} />
                        <button onClick={testDbConnection} disabled={dbStatus === 'testing'} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg shadow-sm disabled:opacity-50">Tester la connexion</button>
                    </div>
                </div>

                {/* Asterisk Configuration */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-2xl font-semibold text-slate-800 mb-4 flex items-center"><ServerStackIcon className="w-6 h-6 mr-3 text-indigo-600"/> Téléphonie (Asterisk)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <div className="md:col-span-2 font-semibold">Interface de Management (AMI)</div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Hôte AMI</label>
                            <input type="text" value={settings.asterisk.amiHost} onChange={e => handleChange('asterisk', 'amiHost', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Port AMI</label>
                            <input type="number" value={settings.asterisk.amiPort} onChange={e => handleChange('asterisk', 'amiPort', parseInt(e.target.value))} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Utilisateur AMI</label>
                            <input type="text" value={settings.asterisk.amiUser} onChange={e => handleChange('asterisk', 'amiUser', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Mot de passe AMI</label>
                            <input type="password" value={settings.asterisk.amiPassword} onChange={e => handleChange('asterisk', 'amiPassword', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                        </div>
                        <div className="md:col-span-2 pt-2 border-t mt-2 font-semibold">Interface de Gateway (AGI)</div>
                         <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Port AGI du Backend</label>
                            <input type="number" value={settings.asterisk.agiPort} onChange={e => handleChange('asterisk', 'agiPort', parseInt(e.target.value))} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                             <p className="text-xs text-slate-500 mt-1">Ce port doit correspondre à celui configuré dans le fichier `.env` du backend et dans le `extensions.conf` d'Asterisk.</p>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-4">
                        <ConnectionStatusIndicator status={amiStatus} />
                        <button onClick={testAmiConnection} disabled={amiStatus === 'testing'} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg shadow-sm disabled:opacity-50">Tester la connexion AMI</button>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end items-center">
                {showSuccess && <span className="text-green-600 font-semibold mr-4 transition-opacity duration-300">Paramètres sauvegardés !</span>}
                <button
                    onClick={handleSave}
                    disabled={!isDirty}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
                >
                    Enregistrer les modifications
                </button>
            </div>
        </div>
    );
};

export default SystemConnectionManager;
