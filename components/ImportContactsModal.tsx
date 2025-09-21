
import React, { useState, useMemo } from 'react';
import type { Contact, SavedScript, Campaign, ScriptBlock } from '../types.ts';
import { ArrowUpTrayIcon, ArrowRightIcon, CheckIcon, XMarkIcon } from './Icons.tsx';

interface ImportContactsModalProps {
    onClose: () => void;
    onImport: (newContacts: Contact[]) => void;
    campaign: Campaign;
    script: SavedScript | null;
}

type CsvRow = Record<string, string>;

// Mock CSV for simulation
const MOCK_CONTACTS_CSV = {
    headers: ["prenom", "nom", "telephone", "code_postal", "ville_preferee"],
    data: [
        { prenom: "Julien", nom: "Martin", telephone: "0612345678", code_postal: "75001", ville_preferee: "Paris" },
        { prenom: "Marie", nom: "Bernard", telephone: "0687654321", code_postal: "13002", ville_preferee: "Marseille" },
        { prenom: "Thomas", nom: "Dubois", telephone: "invalid-phone", code_postal: "69003", ville_preferee: "Lyon" },
        { prenom: "Manquant", nom: "Nom", telephone: "0611223344", code_postal: "", ville_preferee: "" },
        { prenom: "", nom: "PrenomManquant", telephone: "0655667788", code_postal: "31000", ville_preferee: "Toulouse" },
    ]
};

const ImportContactsModal: React.FC<ImportContactsModalProps> = ({ onClose, onImport, campaign, script }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvData, setCsvData] = useState<CsvRow[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [summary, setSummary] = useState<{ total: number; valids: Contact[]; invalids: { row: CsvRow; reason: string }[] } | null>(null);

    const mappingFields = useMemo(() => {
        const standardFields = [
            { id: 'firstName', name: 'Prénom' },
            { id: 'lastName', name: 'Nom' },
            { id: 'phoneNumber', name: 'Numéro de téléphone' },
            { id: 'postalCode', name: 'Code Postal' },
        ];
        if (!script) return standardFields;

        const scriptFields = script.pages
            .flatMap(page => page.blocks)
            .filter((block: ScriptBlock) => ['input', 'email', 'phone', 'date', 'time', 'radio', 'checkbox', 'dropdown'].includes(block.type))
            .map((block: ScriptBlock) => ({ id: `custom.${block.name}`, name: `Script: ${block.name}` }));
        
        return [...standardFields, ...scriptFields];
    }, [script]);

    const handleFileSelect = (selectedFile: File) => {
        setFile(selectedFile);
        // Simulate parsing the file
        setCsvHeaders(MOCK_CONTACTS_CSV.headers);
        setCsvData(MOCK_CONTACTS_CSV.data);

        // Auto-map based on header names
        const initialMappings: Record<string, string> = {};
        MOCK_CONTACTS_CSV.headers.forEach(header => {
            const h = header.toLowerCase();
            if (h.includes('prenom') || h.includes('first')) initialMappings[header] = 'firstName';
            if (h.includes('nom') || h.includes('last')) initialMappings[header] = 'lastName';
            if (h.includes('phone') || h.includes('tel') || h.includes('num')) initialMappings[header] = 'phoneNumber';
            if (h.includes('postal') || h.includes('cp')) initialMappings[header] = 'postalCode';
            // Auto-map custom fields
            const matchingScriptField = mappingFields.find(f => f.id.startsWith('custom.') && h.includes(f.name.replace('Script: ', '').toLowerCase()));
            if(matchingScriptField) {
                 initialMappings[header] = matchingScriptField.id;
            }
        });
        setMappings(initialMappings);
    };

    const processAndGoToSummary = () => {
        const valids: Contact[] = [];
        const invalids: { row: CsvRow; reason: string }[] = [];
        const existingPhones = new Set(campaign.contacts.map(c => c.phoneNumber));

        csvData.forEach((row, index) => {
            const getVal = (fieldId: string) => row[Object.keys(mappings).find(h => mappings[h] === fieldId) || ''] || '';
            
            const firstName = getVal('firstName');
            const lastName = getVal('lastName');
            const phoneNumber = getVal('phoneNumber');
            const postalCode = getVal('postalCode');

            if (!firstName || !lastName || !phoneNumber) {
                invalids.push({ row, reason: "Champs obligatoires (prénom, nom, téléphone) manquants." });
                return;
            }
            if (existingPhones.has(phoneNumber) || valids.some(c => c.phoneNumber === phoneNumber)) {
                invalids.push({ row, reason: `Le numéro de téléphone ${phoneNumber} existe déjà.` });
                return;
            }
            // Basic phone validation
            if (!/^\d{10,}$/.test(phoneNumber.replace(/\s/g, ''))) {
                invalids.push({ row, reason: `Format de téléphone invalide pour ${phoneNumber}.` });
                return;
            }

            const customFields: Record<string, any> = {};
            Object.keys(mappings).forEach(header => {
                if (mappings[header].startsWith('custom.')) {
                    const fieldName = mappings[header].replace('custom.', '');
                    customFields[fieldName] = row[header];
                }
            });

            valids.push({
                id: `contact-import-${Date.now() + index}`,
                firstName,
                lastName,
                phoneNumber,
                postalCode,
                status: 'pending',
                customFields,
            });
        });

        setSummary({ total: csvData.length, valids, invalids });
        setStep(3);
    };

    const handleFinalImport = () => {
        if (!summary) return;
        onImport(summary.valids);
        onClose();
    };

    const isNextDisabled = useMemo(() => {
        if (step === 1 && !file) return true;
        if (step === 2) {
            const mappedFields = Object.values(mappings);
            if (!mappedFields.includes('firstName') || !mappedFields.includes('lastName') || !mappedFields.includes('phoneNumber')) {
                return true;
            }
        }
        return false;
    }, [step, file, mappings]);

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-4">
                        <label className="block w-full cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 text-center hover:border-indigo-500">
                            <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-slate-400" />
                            <span className="mt-2 block text-sm font-medium text-slate-900">{file ? file.name : "Téléverser un fichier de contacts (CSV)"}</span>
                            <input type='file' className="sr-only" accept=".csv" onChange={e => e.target.files && handleFileSelect(e.target.files[0])} />
                        </label>
                        {file && <p className="text-center text-xs text-slate-500">Simulation: Le contenu du fichier a été chargé à partir de données de démonstration.</p>}
                    </div>
                );
            case 2:
                return (
                     <div className="space-y-3">
                        <p className="text-sm text-slate-600">Faites correspondre les colonnes de votre fichier aux champs de contact. Les champs Prénom, Nom et Téléphone sont obligatoires.</p>
                        <div className="max-h-80 overflow-y-auto rounded-md border p-2 space-y-2 bg-slate-50">
                            {csvHeaders.map(header => (
                                <div key={header} className="grid grid-cols-2 gap-4 items-center p-1">
                                    <span className="font-medium text-slate-700 truncate">{header}</span>
                                    <select value={mappings[header] || ''} onChange={e => setMappings(prev => ({...prev, [header]: e.target.value}))} className="w-full p-2 border bg-white rounded-md">
                                        <option value="">Ignorer cette colonne</option>
                                        {mappingFields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 3: 
                if (!summary) return null;
                return (
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-slate-800">Résumé de la validation</h3>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="bg-slate-50 p-4 rounded-md border"><p className="text-2xl font-bold">{summary.total}</p><p className="text-sm text-slate-500">Lignes lues</p></div>
                            <div className="bg-green-50 p-4 rounded-md border border-green-200"><p className="text-2xl font-bold text-green-700">{summary.valids.length}</p><p className="text-sm text-green-600">Contacts à importer</p></div>
                            <div className="bg-red-50 p-4 rounded-md border border-red-200"><p className="text-2xl font-bold text-red-700">{summary.invalids.length}</p><p className="text-sm text-red-600">Lignes invalides</p></div>
                        </div>
                        {summary.invalids.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-slate-700 mb-2">Détail des erreurs</h4>
                                <div className="max-h-40 overflow-y-auto text-sm border rounded-md bg-slate-50">
                                    <table className="min-w-full">
                                        <thead className="bg-slate-200 sticky top-0"><tr className="text-left"><th className="p-2">Ligne</th><th className="p-2">Erreur</th></tr></thead>
                                        <tbody>
                                        {summary.invalids.map((item, i) => (
                                            <tr key={i} className="border-t"><td className="p-2 font-mono text-xs">{JSON.stringify(item.row)}</td><td className="p-2 text-red-600">{item.reason}</td></tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                );
            default: return null;
        }
    };
    
    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[90vh] flex flex-col">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-semibold text-slate-900">Importer des contacts dans "{campaign.name}"</h3>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">{renderStepContent()}</div>
                <div className="bg-slate-50 px-6 py-4 flex justify-between rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700">Annuler</button>
                    <div className="flex gap-3">
                         {step > 1 && step < 4 && <button onClick={() => setStep(s => s - 1)} className="rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm hover:bg-slate-50">Retour</button>}
                        {step < 2 && <button onClick={() => setStep(2)} disabled={isNextDisabled} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300">Suivant <ArrowRightIcon className="w-4 h-4"/></button>}
                        {step === 2 && <button onClick={processAndGoToSummary} disabled={isNextDisabled} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300">Valider les données</button>}
                        {step === 3 && <button onClick={handleFinalImport} className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-green-700">Confirmer et Importer</button>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportContactsModal;
