import React, { useState, useMemo } from 'react';
import type { Campaign, SavedScript, Contact, ScriptBlock } from '../types.ts';
import { ArrowUpTrayIcon, CheckIcon, XMarkIcon, ArrowRightIcon } from './Icons.tsx';

declare var Papa: any;
declare var XLSX: any;

interface ImportContactsModalProps {
    campaign: Campaign;
    script: SavedScript | null;
    onClose: () => void;
    onImport: (newContacts: Contact[]) => void;
}

type CsvRow = Record<string, string>;

const ImportContactsModal: React.FC<ImportContactsModalProps> = ({ campaign, script, onClose, onImport }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvData, setCsvData] = useState<CsvRow[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({}); // { [scriptFieldId]: csvHeader }
    const [summary, setSummary] = useState<{ total: number; valids: Contact[]; invalids: { row: CsvRow; reason: string }[] } | null>(null);

    const scriptFields = useMemo(() => {
        if (!script) return [];
        const fields: { id: string, name: string, type: 'standard' | 'script' }[] = [];
        script.pages.forEach(page => {
            page.blocks.forEach(block => {
                if (['input', 'textarea', 'email', 'phone', 'date', 'time', 'radio', 'checkbox', 'dropdown'].includes(block.type) && block.fieldName) {
                    fields.push({ id: block.fieldName, name: block.name, type: 'script' });
                }
            });
        });
        return fields;
    }, [script]);
    
    const phoneField = scriptFields.find(f => {
        const block = script?.pages.flatMap(p => p.blocks).find(b => b.fieldName === f.id);
        return block?.type === 'phone';
    });

    const handleFileSelect = (selectedFile: File) => {
        setFile(selectedFile);
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const fileContent = e.target?.result;
                if (!fileContent) throw new Error("Le contenu du fichier est vide.");

                let headers: string[] = [];
                let data: CsvRow[] = [];
                const fileNameLower = selectedFile.name.toLowerCase();

                if (fileNameLower.endsWith('.xlsx')) {
                    const workbook = XLSX.read(fileContent, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    // Fix: Remove type argument from untyped function call and use type assertion.
                    data = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as CsvRow[];
                    if (data.length > 0) headers = Object.keys(data[0]);
                } else { // Handle CSV and TXT with Papaparse
                    const result = Papa.parse(fileContent as string, {
                        header: true,
                        skipEmptyLines: true,
                        encoding: "UTF-8",
                    });
                    
                    if (result.errors.length > 0) console.warn("Erreurs de parsing:", result.errors);
                    
                    headers = result.meta.fields || [];
                    data = result.data;
                }

                setCsvHeaders(headers);
                setCsvData(data);
                
                // Auto-map fields
                const initialMappings: Record<string, string> = {};
                const usedHeaders = new Set<string>();

                scriptFields.forEach(field => {
                    const fieldNameLower = field.name.toLowerCase().replace(/[\s\-_]+/g, '');
                    const foundHeader = headers.find(h => !usedHeaders.has(h) && h.toLowerCase().replace(/[\s\-_]+/g, '') === fieldNameLower);

                    if (foundHeader) {
                        initialMappings[field.id] = foundHeader;
                        usedHeaders.add(foundHeader);
                    }
                });
                setMappings(initialMappings);

            } catch (error) {
                console.error("Erreur lors de la lecture du fichier:", error);
                alert("Une erreur est survenue lors de la lecture du fichier. Assurez-vous qu'il est valide et non corrompu.");
            }
        };

        reader.onerror = () => alert("Impossible de lire le fichier.");

        if (selectedFile.name.toLowerCase().endsWith('.xlsx')) {
            reader.readAsBinaryString(selectedFile);
        } else {
            reader.readAsText(selectedFile, 'UTF-8');
        }
    };
    
    const processAndGoToSummary = () => {
        const valids: Contact[] = [];
        const invalids: { row: CsvRow; reason: string }[] = [];
        const phoneFieldName = phoneField?.id;

        csvData.forEach((row, index) => {
            const customFields: Record<string, any> = {};
            let phoneNumber = '';
            
            for (const fieldId in mappings) {
                const csvHeader = mappings[fieldId];
                if (csvHeader) customFields[fieldId] = row[csvHeader];
            }
            if(phoneFieldName) phoneNumber = customFields[phoneFieldName];

            let reason = '';
            if (!phoneNumber || !/^\d{9,}$/.test(phoneNumber.replace(/[\s.-]+/g, ''))) {
                reason = "Numéro de téléphone invalide ou manquant.";
            }

            if (reason) {
                invalids.push({ row, reason });
            } else {
                valids.push({
                    id: `contact-import-${Date.now() + index}`,
                    status: 'pending',
                    firstName: '', // These are now part of customFields
                    lastName: '',
                    phoneNumber: phoneNumber,
                    postalCode: '',
                    customFields,
                });
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
        if (step === 2 && phoneField && !mappings[phoneField.id]) return true; // Phone number mapping is mandatory
        return false;
    }, [step, file, mappings, phoneField]);
    
    const usedCsvHeaders = Object.values(mappings);

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-4">
                        <label className="block w-full cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 text-center hover:border-indigo-500">
                            <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-slate-400" />
                            <span className="mt-2 block text-sm font-medium text-slate-900">{file ? file.name : "Téléverser un fichier (CSV, TXT, XLSX)"}</span>
                            <input type='file' className="sr-only" accept=".csv,.txt,.xlsx" onChange={e => e.target.files && handleFileSelect(e.target.files[0])} />
                        </label>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-3">
                        <p className="text-sm text-slate-600">Faites correspondre les colonnes de votre fichier (à droite) aux champs de destination du script (à gauche). Un champ de type "Téléphone" est obligatoire.</p>
                        <div className="max-h-80 overflow-y-auto rounded-md border p-2 space-y-2 bg-slate-50">
                             {scriptFields.map(field => {
                                const isPhoneField = phoneField?.id === field.id;
                                return (
                                <div key={field.id} className="grid grid-cols-2 gap-4 items-center p-1">
                                    <span className="font-medium text-slate-700 truncate">
                                        {field.name}
                                        {isPhoneField && <span className="text-red-500 ml-1">*</span>}
                                    </span>
                                    <select
                                        value={mappings[field.id] || ''}
                                        onChange={e => {
                                            const newCsvHeader = e.target.value;
                                            setMappings(prev => {
                                                const newMappings = { ...prev };
                                                Object.keys(newMappings).forEach(key => { if(newMappings[key] === newCsvHeader) delete newMappings[key]; });
                                                if (newCsvHeader) newMappings[field.id] = newCsvHeader;
                                                else delete newMappings[field.id];
                                                return newMappings;
                                            });
                                        }}
                                        className="w-full p-2 border bg-white rounded-md"
                                    >
                                        <option value="">Ignorer ce champ</option>
                                        {csvHeaders.map(header => (
                                            <option key={header} value={header} disabled={usedCsvHeaders.includes(header) && mappings[field.id] !== header}>{header}</option>
                                        ))}
                                    </select>
                                </div>
                            )})}
                        </div>
                    </div>
                );
            case 3:
                // ... same as before
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
                // ... same as before
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