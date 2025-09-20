import React, { useState, useEffect } from 'react';
import type { Feature, Site } from '../types.ts';
import { PlusIcon, EditIcon, TrashIcon, WifiIcon } from './Icons.tsx';

interface SiteModalProps {
    site: Site | null;
    onSave: (site: Site) => void;
    onClose: () => void;
}

const SiteModal: React.FC<SiteModalProps> = ({ site, onSave, onClose }) => {
    const [formData, setFormData] = useState<Site>(site || {
        id: `site-${Date.now()}`,
        name: '',
        yeastarIp: '',
        apiUser: '',
        apiPassword: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <h3 className="text-lg font-medium leading-6 text-slate-900">{site ? 'Modifier le Site' : 'Nouveau Site'}</h3>
                        <p className="mt-1 text-sm text-slate-500">Configurez les informations du site et de son PBX Yeastar.</p>
                        <div className="mt-4 space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-slate-700">Nom du site</label>
                                <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full p-2 border border-slate-300 rounded-md" placeholder="Ex: Agence de Paris"/>
                            </div>
                            <div>
                                <label htmlFor="yeastarIp" className="block text-sm font-medium text-slate-700">Adresse IP du Yeastar PBX</label>
                                <input type="text" name="yeastarIp" id="yeastarIp" value={formData.yeastarIp} onChange={handleChange} required className="mt-1 block w-full p-2 border border-slate-300 rounded-md" placeholder="Ex: 192.168.1.100"/>
                            </div>
                            <div>
                                <label htmlFor="apiUser" className="block text-sm font-medium text-slate-700">Utilisateur API</label>
                                <input type="text" name="apiUser" id="apiUser" value={formData.apiUser} onChange={handleChange} required className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                            </div>
                            <div>
                                <label htmlFor="apiPassword" className="block text-sm font-medium text-slate-700">Mot de passe API</label>
                                <input type="password" name="apiPassword" id="apiPassword" value={formData.apiPassword} onChange={handleChange} required className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse rounded-b-lg">
                        <button type="submit" className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 sm:ml-3 sm:w-auto">Enregistrer</button>
                        <button type="button" onClick={onClose} className="mt-3 inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:mt-0 sm:w-auto">Annuler</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface SiteManagerProps {
    feature: Feature;
    sites: Site[];
    onSaveSite: (site: Site) => void;
    onDeleteSite: (siteId: string) => void;
}

type SiteConnectionStatus = 'ok' | 'nok' | 'testing';

const SiteManager: React.FC<SiteManagerProps> = ({ feature, sites, onSaveSite, onDeleteSite }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<Site | null>(null);
    const [siteStatuses, setSiteStatuses] = useState<Record<string, { status: SiteConnectionStatus; latency: number | null }>>({});

    const checkSiteStatus = (site: Site) => {
        setSiteStatuses(prev => ({ ...prev, [site.id]: { status: 'testing', latency: null } }));

        setTimeout(() => {
            const isSuccess = Math.random() > 0.15; // 85% success rate
            const latency = isSuccess ? Math.floor(Math.random() * 180) + 20 : null;

            setSiteStatuses(prev => ({
                ...prev,
                [site.id]: {
                    status: isSuccess ? 'ok' : 'nok',
                    latency,
                },
            }));
        }, 500 + Math.random() * 1000);
    };

    useEffect(() => {
        sites.forEach(site => {
            checkSiteStatus(site);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sites]);

    const handleAddNew = () => {
        setEditingSite(null);
        setIsModalOpen(true);
    };

    const handleEdit = (site: Site) => {
        setEditingSite(site);
        setIsModalOpen(true);
    };

    const handleSave = (site: Site) => {
        onSaveSite(site);
        setIsModalOpen(false);
        setEditingSite(null);
    };

    const StatusIndicator: React.FC<{ siteId: string }> = ({ siteId }) => {
        const siteStatus = siteStatuses[siteId];

        if (!siteStatus || siteStatus.status === 'testing') {
            return (
                <div className="flex items-center">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                    <span className="ml-2 text-xs text-slate-500 italic">Test en cours...</span>
                </div>
            );
        }

        if (siteStatus.status === 'ok') {
            return (
                <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="ml-2 text-sm font-mono text-slate-700">{siteStatus.latency} ms</span>
                </div>
            );
        }

        if (siteStatus.status === 'nok') {
            return (
                <div className="flex items-center">
                    <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    </div>
                    <span className="ml-2 text-sm font-semibold text-red-600">Injoignable</span>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {isModalOpen && <SiteModal site={editingSite} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-slate-800">Sites configurés</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => sites.forEach(checkSiteStatus)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 px-4 rounded-lg inline-flex items-center text-sm"
                            title="Vérifier la latence de tous les sites"
                        >
                            <WifiIcon className="w-4 h-4 mr-2" />
                            Vérifier la latence
                        </button>
                        <button onClick={handleAddNew} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md inline-flex items-center">
                            <PlusIcon className="w-5 h-5 mr-2" />Ajouter un Site
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nom</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">IP du PBX</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Utilisateur API</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {sites.map(site => (
                                <tr key={site.id}>
                                    <td className="px-6 py-4">
                                        <StatusIndicator siteId={site.id} />
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-800">{site.name}</td>
                                    <td className="px-6 py-4 text-slate-600 font-mono text-sm">{site.yeastarIp}</td>
                                    <td className="px-6 py-4 text-slate-600 font-mono text-sm">{site.apiUser}</td>
                                    <td className="px-6 py-4 text-right text-sm font-medium space-x-4">
                                        <button onClick={() => handleEdit(site)} className="text-indigo-600 hover:text-indigo-900"><EditIcon className="w-4 h-4 inline-block -mt-1"/> Modifier</button>
                                        <button onClick={() => onDeleteSite(site.id)} className="text-red-600 hover:text-red-900"><TrashIcon className="w-4 h-4 inline-block -mt-1"/> Supprimer</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {sites.length === 0 && <p className="text-center py-8 text-slate-500">Aucun site configuré.</p>}
                </div>
            </div>
        </div>
    );
};

export default SiteManager;