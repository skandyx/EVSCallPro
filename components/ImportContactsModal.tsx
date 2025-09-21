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

const ImportContactsModal: React.FC<ImportContactsModalProps> = ({ campaign, script, onClose, onImport }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvData, setCsvData] = useState<CsvRow[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [summary, setSummary] = useState<{ total: number; valids: Contact[]; invalids: { row: CsvRow; reason: string }[] } | null>(null);
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    
    const scriptInputFields = useMemo(() => {
        if (!script) return [];
        const inputBlocks: ScriptBlock[] = [];
        script.pages.forEach(page => {
            page.blocks.forEach(block => {
                if (['input', 'textarea', 'email', 'phone', 'date', 'time', 'radio', 'checkbox', 'dropdown'].includes(block.type)) {
                    inputBlocks.push(block);
                }
            });
        });
        return inputBlocks.sort((a,b) => {
            if (a.type === 'phone') return -1;
            if (b.type === 'phone') return 1;
            return 0;
        });
    }, [script]);

    const handleFileSelect = (selectedFile: File) => {
        if (!selectedFile) return;
        setFile(selectedFile);
        setIsLoadingFile(true);

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) {
                setIsLoadingFile(false);
                return;
            }

            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length === 0) {
                setCsvHeaders([]);
                setCsvData([]);
                setIsLoadingFile(false);
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim());
            const data = lines.slice(1).map(line => {
                const values = line.split(',');
                return headers.reduce((obj, header, index) => {
                    obj[header] = values[index]?.trim() || '';
                    return obj;
                }, {} as CsvRow);
            });
            
            setCsvHeaders(headers);
            setCsvData(data);

            // Auto-map obvious fields
            const initialMappings: Record<string, string> = {};
            scriptInputFields.forEach(field => {
                 const fieldNameLower = field.name.toLowerCase().replace(/ /g, '_');
                 const fieldNameSimple = fieldNameLower.replace(/[^a-z0-9]/gi, '');

                const matchingHeader = headers.find(header => {
                    const h = header.toLowerCase().replace(/ /g, '_');
                    const hSimple = h.replace(/[^a-z0-9]/gi, '');

                    if (field.type === 'phone') {
                        return h.includes('phone') || h.includes('tel') || h.includes('num');
                    }
                    return h === fieldNameLower || hSimple === fieldNameSimple;
                });

                if (matchingHeader) {
                    initialMappings[field.fieldName] = matchingHeader;
                }
            });
            setMappings(initialMappings);
            setIsLoadingFile(false);
        };
        reader.onerror = () => {
             alert("Erreur lors de la lecture du fichier.");
             setIsLoadingFile(false);
        };

        reader.readAsText(selectedFile, 'UTF-8');
    };

    const processAndGoToSummary = () => {
        const valids: Contact[] = [];
        const invalids: { row: CsvRow; reason: string }[] = [];
        
        const phoneField = scriptInputFields.find(f => f.type === 'phone');
        if (!phoneField || !mappings[phoneField.fieldName]) {
            alert("Erreur: Vous devez faire correspondre un champ de type 'Téléphone' du script.");
            return;
        }
        const phoneHeader = mappings[phoneField.fieldName];

        csvData.forEach((row, index) => {
            const phoneNumber = row[phoneHeader] || '';
            if (!phoneNumber || !/^\d{9,}$/.test(phoneNumber.replace(/\s/g, ''))) {
                invalids.push({ row, reason: "Numéro de téléphone manquant ou invalide." });
                return;
            }

            const customFields: Record<string, any> = {};
            let firstName = '', lastName = '', postalCode = '';

            scriptInputFields.forEach(field => {
                const header = mappings[field.fieldName];
                const value = header ? row[header] : '';
                if (value) {
                    customFields[field.fieldName] = value;
                    const fieldNameLower = field.fieldName.toLowerCase();
                    if (fieldNameLower.includes('prenom') || fieldNameLower.includes('first')) firstName = value;
                    if (fieldNameLower.includes('nom') || fieldNameLower.includes('last')) lastName = value;
                    if (fieldNameLower.includes('postal') || fieldNameLower.includes('cp')) postalCode = value;
                }
            });

            valids.push({
                id: `contact-import-${Date.now() + index}`,
                phoneNumber,
                firstName,
                lastName,
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
        setStep(4);
    };

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-4">
                         <p className="text-sm text-slate-600">Sélectionnez un fichier CSV à importer dans la campagne <span className="font-semibold">{campaign.name}</span>. Le fichier doit être encodé en UTF-8 pour supporter les caractères spéciaux (ex: Arabe).</p>
                        <label className="block w-full cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 text-center hover:border-indigo-500">
                            <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-slate-400" />
                            <span className="mt-2 block text-sm font-medium text-slate-900">{isLoadingFile ? "Analyse en cours..." : file ? file.name : "Téléverser un fichier CSV"}</span>
                            <input type='file' className="sr-only" accept=".csv" onChange={e => e.target.files && handleFileSelect(e.target.files[0])} />
                        </label>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-3">
                        <p className="text-sm text-slate-600">Faites correspondre les colonnes de votre fichier (à droite) aux champs de destination du script (à gauche). Un champ de type "Téléphone" est obligatoire.</p>
                        <div className="max-h-80 overflow-y-auto rounded-md border p-2 space-y-2 bg-slate-50">
                            {scriptInputFields.map(field => (
                                <div key={field.id} className="grid grid-cols-2 gap-4 items-center p-1">
                                    <span className="font-medium text-slate-700 truncate" title={field.name}>
                                        {field.type === 'phone' && <span className="text-red-500 mr-1">*</span>}
                                        {field.name}
                                    </span>
                                    <select value={mappings[field.fieldName] || ''} onChange={e => setMappings(prev => ({ ...prev, [field.fieldName]: e.target.value }))} className="w-full p-2 border bg-white rounded-md">
                                        <option value="">Ignorer cette colonne</option>
                                        {csvHeaders.map(header => <option key={header} value={header}>{header}</option>)}
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
        if (step === 1 && (!file || isLoadingFile)) return true;
        if (step === 2) {
            const phoneField = scriptInputFields.find(f => f.type === 'phone');
            if (!phoneField || !mappings[phoneField.fieldName]) {
                return true;
            }
        }
        return false;
    }, [step, file, isLoadingFile, mappings, scriptInputFields]);

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