
import React, { useState, useMemo } from 'react';
import type { Campaign, SavedScript, Contact, ScriptBlock } from '../types.ts';
import { ArrowUpTrayIcon, ArrowRightIcon, CheckIcon, XMarkIcon } from './Icons.tsx';

interface ImportContactsModalProps {
    campaign: Campaign;
    script: SavedScript | null;
    onClose: () => void;
    onImport: (newContacts: Contact[]) => void;
}

type CsvRow = Record<string, string>;

// Mock CSV data for simulation
const MOCK_CSV_DATA: { headers: string[], data: CsvRow[] } = {
    headers: ["telephone", "nom", "prenom", "code_postal", "ville", "date_rdv"],
    data: [
        { telephone: "0611223344", nom: "Dupont", prenom: "Jean", code_postal: "75001", ville: "Paris", date_rdv: "2024-09-15" },
        { telephone: "0655667788", nom: "Martin", prenom: "Marie", code_postal: "13008", ville: "Marseille", date_rdv: "2024-09-16" },
        { telephone: "0699887766", nom: "Bernard", prenom: "Luc", code_postal: "69002", ville: "Lyon", date_rdv: "2024-09-17" },
        { telephone: "invalid-phone", nom: "Durand", prenom: "Sophie", code_postal: "31000", ville: "Toulouse", date_rdv: "2024-09-18" },
        { telephone: "0612345678", nom: "", prenom: "Pierre", code_postal: "59000", ville: "Lille", date_rdv: "2024-09-19" },
    ]
};

const ImportContactsModal: React.FC<ImportContactsModalProps> = ({ campaign, script, onClose, onImport }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvData, setCsvData] = useState<CsvRow[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [summary, setSummary] = useState<{ total: number; valids: Contact[]; invalids: { row: CsvRow; reason: string }[] } | null>(null);
    
    const scriptFields = useMemo(() => {
        if (!script) return [];
        const inputBlocks: ScriptBlock[] = [];
        script.pages.forEach(page => {
            page.blocks.forEach(block => {
                if (['input', 'textarea', 'email', 'phone', 'date', 'time', 'radio', 'checkbox', 'dropdown'].includes(block.type)) {
                    inputBlocks.push(block);
                }
            });
        });
        return inputBlocks.map(block => ({ id: block.name, name: block.name }));
    }, [script]);

    const MAPPING_FIELDS = useMemo(() => [
        { id: 'phoneNumber', name: 'Numéro de téléphone (Obligatoire)' },
        { id: 'firstName', name: 'Prénom' },
        { id: 'lastName', name: 'Nom' },
        { id: 'postalCode', name: 'Code Postal' },
        ...scriptFields.map(field => ({ id: `custom:${field.id}`, name: `Script: ${field.name}` })),
    ], [scriptFields]);

    const handleFileSelect = (selectedFile: File) => {
        setFile(selectedFile);
        // Simulate parsing
        setCsvHeaders(MOCK_CSV_DATA.headers);
        setCsvData(MOCK_CSV_DATA.data);
        // Auto-map obvious fields
        const initialMappings: Record<string, string> = {};
        MOCK_CSV_DATA.headers.forEach(header => {
            const h = header.toLowerCase();
            if (h.includes('phone') || h.includes('tel') || h.includes('num')) initialMappings[header] = 'phoneNumber';
            if (h.includes('prénom') || h.includes('first')) initialMappings[header] = 'firstName';
            if (h.includes('nom') || h.includes('last')) initialMappings[header] = 'lastName';
            if (h.includes('postal') || h.includes('cp')) initialMappings[header] = 'postalCode';
            
            // Auto-map custom script fields
            const matchingScriptField = scriptFields.find(sf => h.includes(sf.name.toLowerCase()));
            if (matchingScriptField) {
                initialMappings[header] = `custom:${matchingScriptField.id}`;
            }
        });
        setMappings(initialMappings);
    };

    const processAndGoToSummary = () => {
        const valids: Contact[] = [];
        const invalids: { row: CsvRow; reason: string }[] = [];

        csvData.forEach((row, index) => {
            const getVal = (fieldId: string) => {
                const header = Object.keys(mappings).find(h => mappings[h] === fieldId);
                return header ? row[header] || '' : '';
            };
            
            const phoneNumber = getVal('phoneNumber');
            if (!phoneNumber || !/^\d{10,}$/.test(phoneNumber.replace(/\s/g, ''))) {
                invalids.push({ row, reason: "Numéro de téléphone manquant ou invalide." });
                return;
            }

            const customFields: Record<string, any> = {};
            scriptFields.forEach(sf => {
                const value = getVal(`custom:${sf.id}`);
                if (value) {
                    customFields[sf.id] = value;
                }
            });

            valids.push({
                id: `contact-import-${Date.now() + index}`,
                phoneNumber,
                firstName: getVal('firstName'),
                lastName: getVal('lastName'),
                postalCode: getVal('postalCode'),
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
        setStep(4);
    };

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-4">
                         <p className="text-sm text-slate-600">Sélectionnez un fichier CSV à importer dans la campagne <span className="font-semibold">{campaign.name}</span>. Le fichier doit contenir une colonne pour le numéro de téléphone.</p>
                        <label className="block w-full cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 text-center hover:border-indigo-500">
                            <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-slate-400" />
                            <span className="mt-2 block text-sm font-medium text-slate-900">{file ? file.name : "Téléverser un fichier CSV"}</span>
                            <input type='file' className="sr-only" accept=".csv" onChange={e => e.target.files && handleFileSelect(e.target.files[0])} />
                        </label>
                        {file && <p className="text-center text-xs text-slate-500">Simulation: Le contenu du fichier a été chargé à partir de données de démonstration.</p>}
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-3">
                        <p className="text-sm text-slate-600">Faites correspondre les colonnes de votre fichier aux champs de destination. Le numéro de téléphone est obligatoire.</p>
                        <div className="max-h-80 overflow-y-auto rounded-md border p-2 space-y-2 bg-slate-50">
                            {csvHeaders.map(header => (
                                <div key={header} className="grid grid-cols-2 gap-4 items-center p-1">
                                    <span className="font-medium text-slate-700 truncate">{header}</span>
                                    <select value={mappings[header] || ''} onChange={e => setMappings(prev => ({ ...prev, [header]: e.target.value }))} className="w-full p-2 border bg-white rounded-md">
                                        <option value="">Ignorer cette colonne</option>
                                        {MAPPING_FIELDS.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
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
            case 4:
                return (
                    <div className="text-center py-8">
                        <CheckIcon className="mx-auto h-16 w-16 text-green-500" />
                        <h3 className="text-xl font-semibold text-slate-800 mt-4">Importation terminée !</h3>
                        <p className="text-slate-600 mt-2"><span className="font-bold">{summary?.valids.length || 0}</span> contacts ont été ajoutés avec succès à la campagne <span className="font-semibold">{campaign.name}</span>.</p>
                    </div>
                );
            default: return null;
        }
    };
    
    const isNextDisabled = useMemo(() => {
        if (step === 1 && !file) return true;
        if (step === 2 && !Object.values(mappings).includes('phoneNumber')) return true;
        return false;
    }, [step, file, mappings]);

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[90vh] flex flex-col">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-semibold text-slate-900">Importer des contacts par CSV</h3>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">{renderStepContent()}</div>
                <div className="bg-slate-50 px-6 py-4 flex justify-between rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700">Fermer</button>
                    <div className="flex gap-3">
                        {step > 1 && step < 4 && <button onClick={() => setStep(s => s - 1)} className="rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm hover:bg-slate-50">Retour</button>}
                        {step === 1 && <button onClick={() => setStep(2)} disabled={isNextDisabled} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300">Suivant <ArrowRightIcon className="w-4 h-4" /></button>}
                        {step === 2 && <button onClick={processAndGoToSummary} disabled={isNextDisabled} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300">Valider les données <ArrowRightIcon className="w-4 h-4" /></button>}
                        {step === 3 && <button onClick={handleFinalImport} className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-green-700">Confirmer et Importer</button>}
                        {step === 4 && <button onClick={onClose} className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700">Terminer</button>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportContactsModal;
