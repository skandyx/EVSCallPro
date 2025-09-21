import React, { useState, useMemo } from 'react';
import type { Campaign, SavedScript, Contact } from '../types.ts';
import { ArrowUpTrayIcon, CheckIcon, XMarkIcon, ArrowRightIcon } from './Icons.tsx';

interface ImportContactsModalProps {
    campaign: Campaign;
    script: SavedScript | null;
    onClose: () => void;
    onImport: (newContacts: Contact[]) => void;
}

// Mocking file parsing for demonstration
type CsvRow = Record<string, string>;

// A more realistic mock that could be generated from a file upload
const MOCK_CSV_DATA: { headers: string[], data: CsvRow[] } = {
    headers: ["nom", "prenom", "telephone", "code_postal", "ville", "info_produit"],
    data: [
        { nom: "Durand", prenom: "Pierre", telephone: "0612345678", code_postal: "75001", ville: "Paris", info_produit: "Intéressé par le modèle A" },
        { nom: "Martin", prenom: "Sophie", telephone: "0787654321", code_postal: "69002", ville: "Lyon", info_produit: "Client existant" },
        { nom: "Dubois", prenom: "Julien", telephone: "06invalid", code_postal: "13001", ville: "Marseille", info_produit: "" },
        { nom: "Petit", prenom: "Camille", telephone: "0611223344", code_postal: "31000", ville: "Toulouse", info_produit: "Rappel demandé" },
        { nom: "Leroy", prenom: "Marie", telephone: "0655555555", code_postal: "invalid", ville: "Nice", info_produit: "A déjà été contacté" },
    ]
};

const ImportContactsModal: React.FC<ImportContactsModalProps> = ({ campaign, script, onClose, onImport }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvData, setCsvData] = useState<CsvRow[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [summary, setSummary] = useState<{ total: number; valids: Contact[]; invalids: { row: CsvRow; reason: string }[] } | null>(null);

    const MAPPING_FIELDS = useMemo(() => {
        const standardFields = [
            { id: 'firstName', name: 'Prénom' },
            { id: 'lastName', name: 'Nom' },
            { id: 'phoneNumber', name: 'Numéro de téléphone' },
            { id: 'postalCode', name: 'Code Postal' },
        ];
        const scriptFields: { id: string, name: string }[] = [];
        if (script) {
            script.pages.forEach(page => {
                page.blocks.forEach(block => {
                    // Only include input-like fields that have a technical fieldName
                    if (['input', 'textarea', 'email', 'phone', 'date', 'time', 'radio', 'checkbox', 'dropdown'].includes(block.type) && block.fieldName) {
                        scriptFields.push({ id: `custom_${block.fieldName}`, name: `Script: ${block.name}` });
                    }
                });
            });
        }
        return [...standardFields, ...scriptFields];
    }, [script]);

    const handleFileSelect = (selectedFile: File) => {
        setFile(selectedFile);
        // Simulate parsing the file. In a real app, you'd use a library like Papaparse.
        // For this demo, we use mock data.
        setCsvHeaders(MOCK_CSV_DATA.headers);
        setCsvData(MOCK_CSV_DATA.data);
        
        // Auto-map obvious fields
        const initialMappings: Record<string, string> = {};
        MOCK_CSV_DATA.headers.forEach(header => {
            const h = header.toLowerCase();
            if (h.includes('nom') && !h.includes('prenom')) initialMappings[header] = 'lastName';
            if (h.includes('prenom') || h.includes('prénom')) initialMappings[header] = 'firstName';
            if (h.includes('tel') || h.includes('phone') || h.includes('téléphone')) initialMappings[header] = 'phoneNumber';
            if (h.includes('postal') || h.includes('cp')) initialMappings[header] = 'postalCode';
        });
        setMappings(initialMappings);
    };

    const processAndGoToSummary = () => {
        const valids: Contact[] = [];
        const invalids: { row: CsvRow; reason: string }[] = [];

        csvData.forEach((row, index) => {
            const newContact: Partial<Contact> & { customFields: Record<string, any> } = {
                id: `contact-import-${Date.now() + index}`,
                status: 'pending',
                customFields: {},
            };
            let reason = '';

            // Map fields based on user selection
            for (const header of csvHeaders) {
                const mapping = mappings[header];
                if (mapping) {
                    const value = row[header];
                    if (mapping.startsWith('custom_')) {
                        const fieldName = mapping.replace('custom_', '');
                        newContact.customFields[fieldName] = value;
                    } else {
                        (newContact as any)[mapping] = value;
                    }
                }
            }
            
            // Validation
            if (!newContact.phoneNumber || !/^\d{10,}$/.test(newContact.phoneNumber.replace(/\s/g, ''))) {
                reason = "Numéro de téléphone invalide ou manquant.";
            } else if (!newContact.lastName && !newContact.firstName) {
                newContact.lastName = `Contact ${newContact.phoneNumber}`; // Default name if none provided
            }

            if (reason) {
                invalids.push({ row, reason });
            } else {
                valids.push(newContact as Contact);
            }
        });

        setSummary({ total: csvData.length, valids, invalids });
        setStep(3);
    };
    
    const handleFinalImport = () => {
        if (!summary) return;
        onImport(summary.valids);
        setStep(4);
    };

    const isNextDisabled = useMemo(() => {
        if (step === 1 && !file) return true;
        if (step === 2 && !Object.values(mappings).includes('phoneNumber')) return true; // Phone number mapping is mandatory
        return false;
    }, [step, file, mappings]);

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Sélectionnez un fichier CSV à importer. La première ligne de votre fichier doit contenir les en-têtes de colonnes (ex: nom, prenom, telephone).
                        </p>
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
                        <p className="text-sm text-slate-600">Faites correspondre les colonnes de votre fichier aux champs de destination. Le <span className="font-bold">Numéro de téléphone</span> est obligatoire.</p>
                        <div className="max-h-80 overflow-y-auto rounded-md border p-2 space-y-2 bg-slate-50">
                            {csvHeaders.map(header => (
                                <div key={header} className="grid grid-cols-2 gap-4 items-center p-1">
                                    <span className="font-medium text-slate-700 truncate">{header}</span>
                                    <select value={mappings[header] || ''} onChange={e => setMappings(prev => ({...prev, [header]: e.target.value}))} className="w-full p-2 border bg-white rounded-md">
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
                        <CheckIcon className="mx-auto h-16 w-16 text-green-500"/>
                        <h3 className="text-xl font-semibold text-slate-800 mt-4">Importation terminée !</h3>
                        <p className="text-slate-600 mt-2"><span className="font-bold">{summary?.valids.length || 0}</span> contacts ont été ajoutés à la campagne "{campaign.name}".</p>
                    </div>
                );
            default: return null;
        }
    };
    
    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[90vh] flex flex-col">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-semibold text-slate-900">Importer des contacts pour "{campaign.name}"</h3>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">{renderStepContent()}</div>
                <div className="bg-slate-50 px-6 py-4 flex justify-between rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700">Fermer</button>
                    <div className="flex gap-3">
                        {step > 1 && step < 4 && <button onClick={() => setStep(s => s - 1)} className="rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm hover:bg-slate-50">Retour</button>}
                        {step === 1 && <button onClick={() => setStep(2)} disabled={isNextDisabled} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300">Suivant <ArrowRightIcon className="w-4 h-4"/></button>}
                        {step === 2 && <button onClick={processAndGoToSummary} disabled={isNextDisabled} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300">Valider les données <ArrowRightIcon className="w-4 h-4"/></button>}
                        {step === 3 && <button onClick={handleFinalImport} className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-green-700">Confirmer et Importer</button>}
                        {step === 4 && <button onClick={onClose} className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700">Terminer</button>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportContactsModal;
