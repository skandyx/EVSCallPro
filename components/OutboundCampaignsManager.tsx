import React, { useState } from 'react';
import type { Feature, Campaign, User, SavedScript, QualificationGroup, Contact } from '../types.ts';
import { PlusIcon, EditIcon, TrashIcon, ArrowUpTrayIcon } from './Icons.tsx';
import ImportContactsModal from './ImportContactsModal.tsx';

// --- CampaignModal ---
interface CampaignModalProps {
    campaign: Campaign | null;
    users: User[];
    scripts: SavedScript[];
    qualificationGroups: QualificationGroup[];
    onSave: (campaign: Campaign) => void;
    onClose: () => void;
}

const CampaignModal: React.FC<CampaignModalProps> = ({ campaign, users, scripts, qualificationGroups, onSave, onClose }) => {
    const [formData, setFormData] = useState<Campaign>(campaign || {
        id: `campaign-${Date.now()}`,
        name: '',
        description: '',
        scriptId: null,
        callerId: '',
        isActive: true,
        assignedUserIds: [],
        qualificationGroupId: qualificationGroups.length > 0 ? qualificationGroups[0].id : null,
        contacts: [],
        dialingMode: 'PROGRESSIVE',
        priority: 5,
        timezone: 'Europe/Paris',
        callingDays: [1, 2, 3, 4, 5],
        callingStartTime: '09:00',
        callingEndTime: '20:00',
        maxAbandonRate: 3,
        paceFactor: 1.2,
        minAgentsBeforeStart: 1,
        retryAttempts: 3,
        retryIntervals: [30, 60, 120],
        retryOnStatus: [],
        amdEnabled: true,
        amdConfidence: 80,
        voicemailAction: 'HANGUP',
        recordingEnabled: true,
        recordingBeep: true,
        maxRingDuration: 25,
        wrapUpTime: 10,
        maxCallDuration: 3600,
        quotaRules: [],
        filterRules: [],
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else if (name === 'scriptId') {
            setFormData(prev => ({ ...prev, scriptId: value === '' ? null : value }));
        } else if (e.target.getAttribute('type') === 'number') {
            const numValue = parseInt(value, 10);
            setFormData(prev => ({ ...prev, [name]: isNaN(numValue) ? 0 : numValue }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl h-[90vh] flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="p-6 border-b">
                        <h3 className="text-lg font-medium leading-6 text-slate-900">{campaign ? 'Modifier la Campagne' : 'Nouvelle Campagne'}</h3>
                    </div>
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Nom de la campagne</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full p-2 border border-slate-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Description</label>
                            <textarea name="description" value={formData.description} onChange={handleChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-md" rows={2} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Script d'agent</label>
                                <select name="scriptId" value={formData.scriptId || ''} onChange={handleChange} className="mt-1 block w-full p-2 border bg-white border-slate-300 rounded-md">
                                    <option value="">Aucun script</option>
                                    {scripts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Groupe de qualifications</label>
                                <select name="qualificationGroupId" value={formData.qualificationGroupId || ''} onChange={handleChange} required className="mt-1 block w-full p-2 border bg-white border-slate-300 rounded-md">
                                    {qualificationGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Mode de numérotation</label>
                                <select name="dialingMode" value={formData.dialingMode} onChange={handleChange} className="mt-1 block w-full p-2 border bg-white border-slate-300 rounded-md">
                                    <option value="PREDICTIVE">Prédictif</option>
                                    <option value="PROGRESSIVE">Progressif</option>
                                    <option value="MANUAL">Manuel</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Numéro présenté (Caller ID)</label>
                                <input type="text" name="callerId" value={formData.callerId} onChange={handleChange} required className="mt-1 block w-full p-2 border border-slate-300 rounded-md" />
                            </div>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700">Temps de Post-Appel (secondes)</label>
                            <input 
                                type="number" 
                                name="wrapUpTime" 
                                value={formData.wrapUpTime} 
                                onChange={handleChange} 
                                min="0" 
                                max="120" 
                                required 
                                className="mt-1 block w-full p-2 border border-slate-300 rounded-md" 
                            />
                            <p className="text-xs text-slate-500 mt-1">Durée maximale autorisée pour l'agent en état "Post-appel" (max 120s).</p>
                        </div>
                         <div className="flex items-start">
                            <div className="flex h-5 items-center">
                                <input id="isActive" name="isActive" type="checkbox" checked={formData.isActive} onChange={handleChange} className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                            </div>
                            <div className="ml-3 text-sm">
                                <label htmlFor="isActive" className="font-medium text-slate-700">Campagne Active</label>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse rounded-b-lg flex-shrink-0">
                        <button type="submit" className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 sm:ml-3 sm:w-auto">Enregistrer</button>
                        <button type="button" onClick={onClose} className="mt-3 inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:mt-0 sm:w-auto">Annuler</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- Main Component ---
interface OutboundCampaignsManagerProps {
    feature: Feature;
    campaigns: Campaign[];
    users: User[];
    savedScripts: SavedScript[];
    qualificationGroups: QualificationGroup[];
    onSaveCampaign: (campaign: Campaign) => void;
    onDeleteCampaign: (campaignId: string) => void;
    onImportContacts: (campaignId: string, contacts: Contact[]) => void;
}

const OutboundCampaignsManager: React.FC<OutboundCampaignsManagerProps> = ({
    feature,
    campaigns,
    users,
    savedScripts,
    qualificationGroups,
    onSaveCampaign,
    onDeleteCampaign,
    onImportContacts,
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importTargetCampaign, setImportTargetCampaign] = useState<Campaign | null>(null);

    const handleAddNew = () => {
        setEditingCampaign(null);
        setIsModalOpen(true);
    };

    const handleEdit = (campaign: Campaign) => {
        setEditingCampaign(campaign);
        setIsModalOpen(true);
    };

    const handleSave = (campaign: Campaign) => {
        onSaveCampaign(campaign);
        setIsModalOpen(false);
        setEditingCampaign(null);
    };

    const handleOpenImportModal = (campaign: Campaign) => {
        setImportTargetCampaign(campaign);
        setIsImportModalOpen(true);
    };

    const handleImport = (newContacts: Contact[]) => {
        if (importTargetCampaign) {
            onImportContacts(importTargetCampaign.id, newContacts);
        }
        setIsImportModalOpen(false);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {isModalOpen && (
                <CampaignModal
                    campaign={editingCampaign}
                    users={users}
                    scripts={savedScripts}
                    qualificationGroups={qualificationGroups}
                    onSave={handleSave}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
            {isImportModalOpen && importTargetCampaign && (
                <ImportContactsModal
                    campaign={importTargetCampaign}
                    script={savedScripts.find(s => s.id === importTargetCampaign.scriptId) || null}
                    onClose={() => setIsImportModalOpen(false)}
                    onImport={handleImport}
                />
            )}
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-slate-800">Campagnes</h2>
                    <button onClick={handleAddNew} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md inline-flex items-center">
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Créer une campagne
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nom</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mode</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Contacts</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {campaigns.map(campaign => (
                                <tr key={campaign.id}>
                                    <td className="px-6 py-4 font-medium text-slate-800">{campaign.name}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${campaign.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                                            {campaign.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{campaign.dialingMode}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{campaign.contacts.length}</td>
                                    <td className="px-6 py-4 text-right text-sm font-medium space-x-4">
                                        <button onClick={() => handleOpenImportModal(campaign)} className="text-slate-500 hover:text-slate-800 inline-flex items-center"><ArrowUpTrayIcon className="w-4 h-4 mr-1"/> Importer</button>
                                        <button onClick={() => handleEdit(campaign)} className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"><EditIcon className="w-4 h-4 mr-1"/> Modifier</button>
                                        <button onClick={() => onDeleteCampaign(campaign.id)} className="text-red-600 hover:text-red-900 inline-flex items-center"><TrashIcon className="w-4 h-4 mr-1"/> Supprimer</button>
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

export default OutboundCampaignsManager;