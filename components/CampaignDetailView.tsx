import React, { useState, useMemo } from 'react';
import type { Campaign, SavedScript, Contact, ScriptBlock } from '../types.ts';
import { ArrowLeftIcon, ArrowDownTrayIcon, TrashIcon, EditIcon, PlusIcon } from './Icons.tsx';

declare var Papa: any;

interface CampaignDetailViewProps {
    campaign: Campaign;
    script: SavedScript | null;
    onBack: () => void;
    onSaveCampaign: (campaign: Campaign) => void;
    onUpdateContact: (contact: Contact) => void;
    onDeleteContacts: (contactIds: string[]) => void;
}

const KpiCard: React.FC<{ title: string; value: string | number; }> = ({ title, value }) => (
    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="text-3xl font-bold text-slate-800">{value}</p>
    </div>
);

const ContactEditModal: React.FC<{ contact: Contact; script: SavedScript | null; onSave: (contact: Contact) => void; onClose: () => void; }> = ({ contact, script, onSave, onClose }) => {
    const [formData, setFormData] = useState(contact);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (['firstName', 'lastName', 'phoneNumber', 'postalCode'].includes(name)) {
            setFormData(prev => ({ ...prev, [name]: value }));
        } else {
            setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [name]: value } }));
        }
    };

    const scriptFields = useMemo(() => {
        if (!script) return [];
        return script.pages.flatMap(p => p.blocks).filter(b => 
            ['input', 'email', 'phone', 'date', 'time', 'textarea'].includes(b.type) && b.fieldName
        );
    }, [script]);

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-6">
                    <h3 className="text-lg font-medium">Modifier le Contact</h3>
                    <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
                         <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-medium">Prénom</label><input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/></div>
                            <div><label className="text-sm font-medium">Nom</label><input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/></div>
                        </div>
                        <div><label className="text-sm font-medium">Téléphone</label><input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/></div>
                        <div><label className="text-sm font-medium">Code Postal</label><input type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/></div>
                        {scriptFields.map(field => (
                            <div key={field.id}>
                                <label className="text-sm font-medium">{field.name}</label>
                                <input type="text" name={field.fieldName} value={formData.customFields?.[field.fieldName] || ''} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-slate-50 p-3 flex justify-end gap-2">
                    <button onClick={onClose} className="border rounded-md px-4 py-2">Annuler</button>
                    <button onClick={() => onSave(formData)} className="bg-indigo-600 text-white rounded-md px-4 py-2">Enregistrer</button>
                </div>
            </div>
        </div>
    );
};


const CampaignDetailView: React.FC<CampaignDetailViewProps> = ({ campaign, script, onBack, onUpdateContact, onDeleteContacts, onSaveCampaign }) => {
    const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
    const [editingContact, setEditingContact] = useState<Contact | null>(null);

    const stats = useMemo(() => {
        const total = campaign.contacts.length;
        const treated = campaign.contacts.filter(c => c.status !== 'pending').length;
        const remaining = total - treated;
        const progress = total > 0 ? (treated / total) * 100 : 0;
        return { total, treated, remaining, progress };
    }, [campaign.contacts]);

    const tableHeaders = useMemo(() => {
        const standard = [
            { id: 'firstName', name: 'Prénom' },
            { id: 'lastName', name: 'Nom' },
            { id: 'phoneNumber', name: 'Téléphone' },
            { id: 'status', name: 'Statut' },
        ];
        if (!script) return standard;
        const scriptHeaders = script.pages.flatMap(p => p.blocks)
            .filter(b => ['input', 'email', 'phone', 'date', 'time', 'radio', 'checkbox', 'dropdown', 'textarea'].includes(b.type))
            .map(b => ({ id: b.fieldName, name: b.name }));
        
        return [...standard, ...scriptHeaders.filter((sh, i, self) => i === self.findIndex(s => s.id === sh.id))];
    }, [script]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedContactIds(new Set(campaign.contacts.map(c => c.id)));
        } else {
            setSelectedContactIds(new Set());
        }
    };
    
    const handleSelectOne = (contactId: string, isChecked: boolean) => {
        setSelectedContactIds(prev => {
            const newSet = new Set(prev);
            if (isChecked) newSet.add(contactId);
            else newSet.delete(contactId);
            return newSet;
        });
    };

    const handleDeleteSelected = () => {
        if (selectedContactIds.size === 0) return;
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${selectedContactIds.size} contact(s) ?`)) {
            onDeleteContacts(Array.from(selectedContactIds));
            setSelectedContactIds(new Set());
        }
    };
    
    const handleExport = () => {
        const dataToExport = campaign.contacts.map(contact => {
            const row: Record<string, any> = {};
            tableHeaders.forEach(header => {
                if (['firstName', 'lastName', 'phoneNumber', 'status'].includes(header.id)) {
                    row[header.name] = (contact as any)[header.id];
                } else if (contact.customFields) {
                    row[header.name] = contact.customFields[header.id] || '';
                }
            });
            return row;
        });
        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `${campaign.name}_contacts.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {editingContact && (
                <ContactEditModal 
                    contact={editingContact}
                    script={script}
                    onSave={(updatedContact) => {
                        onUpdateContact(updatedContact);
                        setEditingContact(null);
                    }}
                    onClose={() => setEditingContact(null)}
                />
            )}
            <header className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100"><ArrowLeftIcon className="w-6 h-6"/></button>
                <div>
                    <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{campaign.name}</h1>
                    <p className="text-lg text-slate-600">{campaign.description}</p>
                </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiCard title="Total Contacts" value={stats.total} />
                <KpiCard title="Contacts Traités" value={stats.treated} />
                <KpiCard title="Contacts Restants" value={stats.remaining} />
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <p className="text-sm font-medium text-slate-500">Progression</p>
                    <div className="w-full bg-slate-200 rounded-full h-4 mt-2"><div className="bg-indigo-600 h-4 rounded-full" style={{ width: `${stats.progress}%` }}></div></div>
                    <p className="text-right text-lg font-bold text-slate-800 mt-1">{stats.progress.toFixed(1)}%</p>
                </div>
            </div>
            
             {campaign.quotaRules.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-800 mb-3">Suivi des Quotas</h2>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {campaign.quotaRules.map(rule => {
                             const progress = rule.limit > 0 ? (rule.currentCount / rule.limit) * 100 : 0;
                             return (
                                 <div key={rule.id} className="bg-slate-50 p-3 rounded-md border">
                                     <p className="text-sm font-medium text-slate-600 truncate">{rule.contactField}: {rule.value}</p>
                                     <div className="w-full bg-slate-200 rounded-full h-2.5 my-1"><div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div></div>
                                     <p className="text-xs text-right font-semibold text-slate-700">{rule.currentCount} / {rule.limit}</p>
                                 </div>
                             )
                        })}
                    </div>
                </div>
            )}
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-slate-800">Liste des Contacts ({campaign.contacts.length})</h2>
                    <div className="flex items-center gap-2">
                         {selectedContactIds.size > 0 && <button onClick={handleDeleteSelected} className="bg-red-100 text-red-700 font-bold py-2 px-3 rounded-lg inline-flex items-center"><TrashIcon className="w-4 h-4 mr-2"/>Supprimer ({selectedContactIds.size})</button>}
                         <button onClick={() => {}} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-3 rounded-lg inline-flex items-center"><PlusIcon className="w-4 h-4 mr-2"/>Ajouter un contact</button>
                        <button onClick={handleExport} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg inline-flex items-center"><ArrowDownTrayIcon className="w-4 h-4 mr-2"/>Exporter les contacts</button>
                    </div>
                </div>
                 <div className="overflow-x-auto max-h-[60vh]">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2"><input type="checkbox" onChange={handleSelectAll} checked={selectedContactIds.size === campaign.contacts.length && campaign.contacts.length > 0} className="rounded"/></th>
                                {tableHeaders.map(h => <th key={h.id} className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{h.name}</th>)}
                                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white divide-y divide-slate-200 text-sm">
                            {campaign.contacts.map(contact => (
                                <tr key={contact.id} className={selectedContactIds.has(contact.id) ? 'bg-indigo-50' : ''}>
                                    <td className="px-4 py-2"><input type="checkbox" checked={selectedContactIds.has(contact.id)} onChange={e => handleSelectOne(contact.id, e.target.checked)} className="rounded"/></td>
                                    {tableHeaders.map(header => (
                                        <td key={header.id} className="px-4 py-2 text-slate-600">
                                            {header.id === 'status'
                                                ? <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${contact.status === 'pending' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>{contact.status}</span>
                                                : (contact as any)[header.id] || contact.customFields?.[header.id] || ''
                                            }
                                        </td>
                                    ))}
                                    <td className="px-4 py-2 text-right">
                                         <button onClick={() => setEditingContact(contact)} className="p-1 rounded-md text-slate-500 hover:bg-slate-100"><EditIcon className="w-4 h-4"/></button>
                                         <button onClick={() => onDeleteContacts([contact.id])} className="p-1 rounded-md text-slate-500 hover:bg-slate-100"><TrashIcon className="w-4 h-4"/></button>
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

export default CampaignDetailView;