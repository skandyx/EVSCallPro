import React, { useState, useMemo } from 'react';
import type { Campaign, SavedScript, Contact, ScriptBlock } from '../types.ts';
import { ArrowUpTrayIcon, CheckIcon, XMarkIcon, ArrowRightIcon } from './Icons.tsx';

interface ImportContactsModalProps {
    campaign: Campaign;
    script: SavedScript | null;
    onClose: () => void;
    onImport: (newContacts: Contact[]) => void;
}

type CsvRow = Record<string, string>;

// --- MOCK DATA & HELPERS ---
const MOCK_CSV_DATA: { headers: string[], data: CsvRow[] } = {
    headers: ["prenom", "nom", "telephone", "code_postal", "ville", "info_complementaire"],
    data: [
        { "prenom": "Jean", "nom": "Dupont", "telephone": "06 12 34 56 78", "code_postal": "75001", "ville": "Paris", "info_complementaire": "Client VIP" },
        { "prenom": "Marie", "nom": "Martin", "telephone": "+33 6 87 65 43 21", "code_postal": "13008", "ville": "Marseille", "info_complementaire": "A rappeler en priorité" },
        { "prenom": "Jean", "nom": "Dupont", "telephone": "0612345678", "code_postal": "75001", "ville": "Paris", "info_complementaire": "Ne pas appeler le matin" }, // Duplicate
        { "prenom": "Alain", "nom": "Bernard", "telephone": "0799887766", "code_postal": "69002", "ville": "Lyon", "info_complementaire": "" },
        { "prenom": "Sophie", "nom": "Durand", "telephone": "invalid-number", "code_postal": "33000", "ville": "Bordeaux", "info_complementaire": "" }, // Invalid number
        { "prenom": "Luc", "nom": "Moreau", "telephone": "0655443322", "code_postal": "59000", "ville": "Lille", "info_complementaire": "Prospect froid" },
        { "prenom": "Claire", "nom": "Simon", "telephone": "0622334455", "code_postal": "06000", "ville": "Nice", "info_complementaire": "" },
        { "prenom": "Paul", "nom": "Leroy", "telephone": "0633445566", "code_postal": "31000", "ville": "Toulouse", "info_complementaire": "" },
        { "prenom": "Jeanne", "nom": "Roux", "telephone": "0644556677", "code_postal": "44000", "ville": "Nantes", "info_complementaire": "Intéressée par produit A" },
        { "prenom": "Pierre", "nom": "Fournier", "telephone": "0655667788", "code_postal": "67000", "ville": "Strasbourg", "info_complementaire": "" },
        { "prenom": "Emilie", "nom": "Morel", "telephone": "0666778899", "code_postal": "34000", "ville": "Montpellier", "info_complementaire": "" },
        { "prenom": "Thomas", "nom": "Girard", "telephone": "0677889900", "code_postal": "35000", "ville": "Rennes", "info_complementaire": "" },
        { "prenom": "Laura", "nom": "Lefebvre", "telephone": "0688990011", "code_postal": "51100", "ville": "Reims", "info_complementaire": "A déjà un contrat" },
        { "prenom": "Julien", "nom": "Mercier", "telephone": "0699001122", "code_postal": "42000", "ville": "Saint-Étienne", "info_complementaire": "" },
        { "prenom": "Camille", "nom": "Gauthier", "telephone": "0700112233", "code_postal": "76600", "ville": "Le Havre", "info_complementaire": "" },
        { "prenom": "Nicolas", "nom": "Chevalier", "telephone": "0711223344", "code_postal": "38000", "ville": "Grenoble", "info_complementaire": "" },
        { "prenom": "Manon", "nom": "Lambert", "telephone": "0722334455", "code_postal": "21000", "ville": "Dijon", "info_complementaire": "" },
        { "prenom": "Alexandre", "nom": "Francois", "telephone": "0733445566", "code_postal": "49000", "ville": "Angers", "info_complementaire": "Rappeler la semaine pro" },
        { "prenom": "Chloé", "nom": "Rousseau", "telephone": "0744556677", "code_postal": "30000", "ville": "Nîmes", "info_complementaire": "" },
        { "prenom": "Antoine", "nom": "Vincent", "telephone": "0755667788", "code_postal": "72000", "ville": "Le Mans", "info_complementaire": "" }
    ]
};

const formatPhoneNumber = (phone: string): string | null => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('330')) return `+33${digits.substring(2)}`;
    if (digits.startsWith('33')) return `+${digits}`;
    if (digits.startsWith('0')) return `+33${digits.substring(1)}`;
    if (digits.length >= 9) return `+${digits}`; // Assume international if no prefix
    return null; // Invalid
};

// --- MAIN COMPONENT ---
const ImportContactsModal: React.FC<ImportContactsModalProps> = ({ campaign, script, onClose, onImport }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvData, setCsvData] = useState<CsvRow[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [dedupeKeys, setDedupeKeys] = useState<string[]>(['phoneNumber']);
    const [summary, setSummary] = useState<{ total: number; duplicates: number; valids: number; duplicateRows: CsvRow[] } | null>(null);

    const { mappingFields, dedupeOptions } = useMemo(() => {
        const standardFields = [
            { id: 'firstName', name: 'Prénom (Standard)' },
            { id: 'lastName', name: 'Nom (Standard)' },
            { id: 'phoneNumber', name: 'Numéro de téléphone (Standard)' },
            { id: 'postalCode', name: 'Code Postal (Standard)' },
        ];

        if (!script || !script.pages || !Array.isArray(script.pages)) {
            return {
                mappingFields: standardFields,
                dedupeOptions: standardFields.filter(f => ['lastName', 'postalCode'].includes(f.id))
            };
        }

        try {
            const scriptFields = script.pages.flatMap(page => page.blocks || [])
                .filter((b: ScriptBlock): b is ScriptBlock => 
                    !!b && !!b.name &&
                    ['input', 'email', 'phone', 'date', 'time', 'radio', 'checkbox', 'dropdown'].includes(b.type)
                )
                .map((b: ScriptBlock) => {
                    const displayName = String(b.content?.label || b.content?.question || b.name);
                    return { 
                        id: b.name,
                        name: `${displayName} (Script)`
                    };
                });
            
            const allMappableFields = [...standardFields, ...scriptFields];
            const allDedupeOptions = allMappableFields.filter(f => f.id !== 'phoneNumber');

            return {
                mappingFields: allMappableFields,
                dedupeOptions: allDedupeOptions,
            };
        } catch (error) {
            console.error("Erreur lors de l'analyse du script pour les champs de mappage:", error);
            return {
                mappingFields: standardFields,
                dedupeOptions: standardFields.filter(f => ['lastName', 'postalCode'].includes(f.id))
            };
        }
    }, [script]);

    const handleFileSelect = (selectedFile: File) => {
        setFile(selectedFile);
        // Simulate parsing
        setCsvHeaders(MOCK_CSV_DATA.headers);
        setCsvData(MOCK_CSV_DATA.data);
        // Auto-map obvious fields
        const initialMappings: Record<string, string> = {};
        MOCK_CSV_DATA.headers.forEach(header => {
            if (header.toLowerCase().includes('prénom') || header.toLowerCase().includes('first')) initialMappings[header] = 'firstName';
            if (header.toLowerCase().includes('nom') || header.toLowerCase().includes('last')) initialMappings[header] = 'lastName';
            if (header.toLowerCase().includes('tel') || header.toLowerCase().includes('phone')) initialMappings[header] = 'phoneNumber';
            if (header.toLowerCase().includes('cp') || header.toLowerCase().includes('postal')) initialMappings[header] = 'postalCode';
        });
        setMappings(initialMappings);
    };

    const processAndGoToSummary = () => {
        const uniqueContacts: Record<string, CsvRow> = {};
        const duplicates: CsvRow[] = [];

        csvData.forEach(row => {
            const phoneNumber = formatPhoneNumber(row[Object.keys(mappings).find(h => mappings[h] === 'phoneNumber') || '']);
            if (!phoneNumber) return; // Skip rows with invalid phone numbers

            let key = phoneNumber;
            dedupeKeys.filter(k => k !== 'phoneNumber').forEach(dedupeKey => {
                const csvHeader = Object.keys(mappings).find(h => mappings[h] === dedupeKey);
                if (csvHeader) {
                    key += `|${row[csvHeader]?.toLowerCase() || ''}`;
                }
            });

            if (uniqueContacts[key]) {
                duplicates.push(row);
            } else {
                uniqueContacts[key] = row;
            }
        });

        setSummary({
            total: csvData.length,
            duplicates: duplicates.length,
            valids: Object.keys(uniqueContacts).length,
            duplicateRows: duplicates,
        });
        setStep(3);
    };

    const handleFinalImport = () => {
        if (!summary) return;
        const newContacts: Contact[] = [];
        // This is simplified; in a real app, we'd use the processed unique contacts list
        for (let i = 0; i < summary.valids; i++) {
            const row = csvData[i];
            const customFields: Record<string, any> = {};
            
            Object.entries(mappings).forEach(([csvHeader, targetField]) => {
                if (!['firstName', 'lastName', 'phoneNumber', 'postalCode'].includes(targetField)) {
                    customFields[targetField] = row[csvHeader];
                }
            });

            newContacts.push({
                id: `contact-import-${Date.now() + i}`,
                firstName: row[Object.keys(mappings).find(h => mappings[h] === 'firstName') || ''] || '',
                lastName: row[Object.keys(mappings).find(h => mappings[h] === 'lastName') || ''] || '',
                phoneNumber: formatPhoneNumber(row[Object.keys(mappings).find(h => mappings[h] === 'phoneNumber') || '']) || '',
                postalCode: row[Object.keys(mappings).find(h => mappings[h] === 'postalCode') || ''] || '',
                status: 'pending',
                customFields: Object.keys(customFields).length > 0 ? customFields : undefined
            });
        }
        onImport(newContacts);
        setStep(4);
    };


    const renderStepContent = () => {
        switch (step) {
            case 1: // Mapping
                return (
                    <div className="space-y-4">
                        <label className="block w-full cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 text-center hover:border-indigo-500">
                            <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-slate-400" />
                            <span className="mt-2 block text-sm font-medium text-slate-900">{file ? file.name : "Téléverser un fichier CSV"}</span>
                            <input type='file' className="sr-only" accept=".csv" onChange={e => e.target.files && handleFileSelect(e.target.files[0])} />
                        </label>
                        {csvHeaders.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-600">Faites correspondre les colonnes de votre fichier aux champs de destination. Le numéro de téléphone est obligatoire.</p>
                                <div className="max-h-64 overflow-y-auto rounded-md border p-2 space-y-2">
                                    {csvHeaders.map(header => (
                                        <div key={header} className="grid grid-cols-2 gap-4 items-center">
                                            <span className="font-medium text-slate-700 truncate">{header}</span>
                                            <select value={mappings[header] || ''} onChange={e => setMappings(prev => ({...prev, [header]: e.target.value}))} className="w-full p-2 border bg-white rounded-md">
                                                <option value="">Ignorer cette colonne</option>
                                                {mappingFields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 2: // Deduplication
                return (
                    <div className="space-y-4">
                         <h3 className="text-lg font-semibold text-slate-800">Dédoublonnage et Formatage</h3>
                         <p className="text-sm text-slate-600">Le système nettoiera vos données avant l'importation. Les numéros de téléphone seront formatés au standard international (E.164).</p>
                         <div className="rounded-md border p-4">
                             <p className="font-semibold mb-2">Identifier les doublons basés sur :</p>
                             <div className="space-y-2">
                                <label className="flex items-center">
                                    <input type="checkbox" checked={true} disabled={true} className="h-4 w-4 rounded border-slate-300 text-indigo-600 disabled:opacity-50"/>
                                    <span className="ml-2 text-sm text-slate-700">Numéro de téléphone (Obligatoire)</span>
                                </label>
                                {dedupeOptions.map(option => {
                                    const isMapped = Object.values(mappings).includes(option.id);
                                    if (!isMapped) return null; // Only show fields that are actually being imported
                                    return (
                                        <label key={option.id} className="flex items-center">
                                            <input type="checkbox" checked={dedupeKeys.includes(option.id)} onChange={e => setDedupeKeys(prev => e.target.checked ? [...prev, option.id] : prev.filter(k => k !== option.id))} className="h-4 w-4 rounded border-slate-300 text-indigo-600"/>
                                            <span className="ml-2 text-sm text-slate-700">{option.name}</span>
                                        </label>
                                    )
                                })}
                             </div>
                         </div>
                    </div>
                );
            case 3: // Summary
                if (!summary) return null;
                return (
                    <div className="space-y-4 text-center">
                        <h3 className="text-xl font-semibold text-slate-800">Résumé de l'importation</h3>
                        <div className="grid grid-cols-2 gap-4 text-left">
                            <div className="bg-slate-50 p-4 rounded-md border">
                                <p className="text-sm text-slate-500">Fiches dans la campagne</p>
                                <p className="text-2xl font-bold text-slate-800">{campaign.contacts.length}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-md border">
                                <p className="text-sm text-slate-500">Lignes dans votre fichier</p>
                                <p className="text-2xl font-bold text-slate-800">{summary.total}</p>
                            </div>
                             <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                                <p className="text-sm text-yellow-600">Doublons identifiés</p>
                                <p className="text-2xl font-bold text-yellow-800">{summary.duplicates}</p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-md border border-green-200">
                                <p className="text-sm text-green-600">Fiches valides à importer</p>
                                <p className="text-2xl font-bold text-green-800">{summary.valids}</p>
                            </div>
                        </div>
                        <button onClick={() => alert("Simulation: Le fichier CSV des doublons serait téléchargé.")} className="text-sm text-indigo-600 hover:underline">Télécharger la liste des doublons</button>
                    </div>
                );
            case 4: // Complete
                return (
                    <div className="text-center py-8">
                        <CheckIcon className="mx-auto h-16 w-16 text-green-500"/>
                        <h3 className="text-xl font-semibold text-slate-800 mt-4">Importation terminée !</h3>
                        <p className="text-slate-600 mt-2"><span className="font-bold">{summary?.valids || 0}</span> contacts ont été ajoutés avec succès à la campagne "{campaign.name}".</p>
                    </div>
                );
            default: return null;
        }
    };

    const isNextDisabled = useMemo(() => {
        if (step === 1 && (!file || !mappings['phoneNumber'])) return true;
        return false;
    }, [step, file, mappings]);
    
    const Stepper = () => (
        <nav aria-label="Progress">
            <ol role="list" className="flex items-center">
                {[1,2,3,4].map(s => {
                    const isCompleted = step > s;
                    const isCurrent = step === s;
                    return (
                        <li key={s} className={`relative ${s < 4 ? 'pr-8 sm:pr-20' : ''}`}>
                            {s > 1 && <div className="absolute inset-0 top-4 -ml-px mt-0.5 h-0.5 w-full bg-slate-200" aria-hidden="true"/>}
                            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white border-2"
                                style={{ borderColor: isCompleted || isCurrent ? '#4f46e5' : '#d1d5db' }}
                            >
                                {isCompleted ? <CheckIcon className="h-5 w-5 text-indigo-600"/> : <span className={`h-2.5 w-2.5 rounded-full ${isCurrent ? 'bg-indigo-600' : 'bg-slate-300'}`}/>}
                            </div>
                        </li>
                    )
                })}
            </ol>
        </nav>
    );

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">Importer des contacts dans "{campaign.name}"</h3>
                        <p className="text-sm text-slate-500">Étape {step} sur 4</p>
                    </div>
                    <Stepper />
                </div>
                <div className="p-6 flex-1 overflow-y-auto">{renderStepContent()}</div>
                <div className="bg-slate-50 px-6 py-4 flex justify-between rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700">Fermer</button>
                    <div className="flex gap-3">
                        {step > 1 && step < 4 && <button onClick={() => setStep(s => s - 1)} className="rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm hover:bg-slate-50">Retour</button>}
                        {step === 1 && <button onClick={() => setStep(2)} disabled={isNextDisabled} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300">Suivant <ArrowRightIcon className="w-4 h-4"/></button>}
                        {step === 2 && <button onClick={processAndGoToSummary} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700">Résumé <ArrowRightIcon className="w-4 h-4"/></button>}
                        {step === 3 && <button onClick={handleFinalImport} className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-green-700">Confirmer et Importer</button>}
                        {step === 4 && <button onClick={onClose} className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700">Terminer</button>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportContactsModal;