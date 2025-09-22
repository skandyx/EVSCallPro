import React, { useState, useMemo } from 'react';
import type { Campaign, SavedScript, Contact, ScriptBlock, FilterRule, QuotaRule } from '../types.ts';
import { ArrowUpTrayIcon, CheckIcon, XMarkIcon, ArrowRightIcon } from './Icons.tsx';

declare var Papa: any;
declare var XLSX: any;

interface ImportContactsModalProps {
    onClose: () => void;
    onImport: (newContacts: Contact[]) => void;
    campaign: Campaign;
    script: SavedScript | null;
}

type CsvRow = Record<string, string>;

interface ValidatedContact extends Contact {
    originalRow: CsvRow;
}

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void; }> = ({ enabled, onChange }) => (
    <button type="button" onClick={() => onChange(!enabled)} className={`${enabled ? 'bg-indigo-600' : 'bg-slate-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`} role="switch" aria-checked={enabled}>
        <span aria-hidden="true" className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
    </button>
);


const ImportContactsModal: React.FC<ImportContactsModalProps> = ({ onClose, onImport, campaign, script }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvData, setCsvData] = useState<CsvRow[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [deduplicationConfig, setDeduplicationConfig] = useState({ enabled: true, fieldId: 'phoneNumber' });
    const [summary, setSummary] = useState<{ total: number; valids: ValidatedContact[]; invalids: { row: CsvRow; reason: string }[] } | null>(null);

    const mappingFields = useMemo(() => {
        const standardFields = [
            { id: 'phoneNumber', name: 'Numéro de Téléphone', required: true },
            { id: 'firstName', name: 'Prénom' },
            { id: 'lastName', name: 'Nom' },
            { id: 'postalCode', name: 'Code Postal' },
        ];

        if (!script) return standardFields;

        const scriptFields = script.pages
            .flatMap(page => page.blocks)
            .filter((block: ScriptBlock) => 
                ['input', 'email', 'phone', 'date', 'time', 'radio', 'checkbox', 'dropdown', 'textarea'].includes(block.type) && block.fieldName
            )
            .map((block: ScriptBlock) => ({ id: block.fieldName, name: block.name, required: false }));

        const uniqueScriptFields = scriptFields.filter((field, index, self) =>
            index === self.findIndex((f) => f.id === field.id) &&
            !standardFields.some(sf => sf.id === field.id)
        );

        return [...standardFields, ...uniqueScriptFields];
    }, [script]);

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
                    data = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as CsvRow[];
                    if (data.length > 0) headers = Object.keys(data[0]);
                } else {
                    const result = Papa.parse(fileContent as string, { header: true, skipEmptyLines: true, encoding: "UTF-8" });
                    if (result.errors.length > 0) console.warn("Erreurs de parsing:", result.errors);
                    headers = result.meta.fields || [];
                    data = result.data as CsvRow[];
                }

                setCsvHeaders(headers);
                setCsvData(data);
                
                const initialMappings: Record<string, string> = {};
                const usedHeaders = new Set<string>();

                mappingFields.forEach(field => {
                    const fieldNameLower = field.name.toLowerCase().replace(/[\s/]+/g, '').replace(/[^\w]/g, '');
                    let foundHeader = headers.find(h => !usedHeaders.has(h) && h.toLowerCase().replace(/[\s\-_]+/g, '').replace(/[^\w]/g, '') === fieldNameLower);
                    if (!foundHeader) {
                        const flexibleMatches: { [key: string]: string[] } = { phoneNumber: ['telephone', 'phone', 'numero'], firstName: ['prenom', 'first'], lastName: ['nom', 'last'], postalCode: ['cp', 'postal', 'zip'] };
                        const alternatives = flexibleMatches[field.id] || [];
                        for(const alt of alternatives) {
                            foundHeader = headers.find(h => !usedHeaders.has(h) && h.toLowerCase().replace(/[\s\-_]+/g, '').replace(/[^\w]/g, '').includes(alt));
                            if(foundHeader) break;
                        }
                    }
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
        if (selectedFile.name.toLowerCase().endsWith('.xlsx')) reader.readAsBinaryString(selectedFile);
        else reader.readAsText(selectedFile, 'UTF-8');
    };
    
    const processAndGoToSummary = () => {
        const valids: ValidatedContact[] = [];
        const invalids: { row: CsvRow; reason: string }[] = [];
        
        const getVal = (row: CsvRow, fieldId: string) => (mappings[fieldId] ? row[mappings[fieldId]] : '') || '';
        
        let existingValues = new Set<string>();
        if (deduplicationConfig.enabled) {
            existingValues = new Set(campaign.contacts.map(c => {
                 if (c.customFields && deduplicationConfig.fieldId in c.customFields) return c.customFields[deduplicationConfig.fieldId];
                 return (c as any)[deduplicationConfig.fieldId] || '';
            }).map(v => v.trim().toLowerCase()).filter(Boolean));
        }
        
        const importedValues = new Set<string>();

        csvData.forEach((row) => {
            const phoneNumber = getVal(row, 'phoneNumber').trim().replace(/\s/g, '');
            if (!phoneNumber) { invalids.push({ row, reason: "Le numéro de téléphone est manquant." }); return; }

            if(deduplicationConfig.enabled) {
                const dedupeValue = getVal(row, deduplicationConfig.fieldId).trim().toLowerCase();
                if(dedupeValue) {
                    if (existingValues.has(dedupeValue) || importedValues.has(dedupeValue)) {
                        invalids.push({ row, reason: `Doublon sur le critère '${mappingFields.find(f => f.id === deduplicationConfig.fieldId)?.name}'.` }); return;
                    }
                    importedValues.add(dedupeValue);
                }
            }
            
            const customFields: Record<string, any> = {};
            mappingFields.forEach(field => {
                if (!['phoneNumber', 'firstName', 'lastName', 'postalCode'].includes(field.id)) {
                    const value = getVal(row, field.id);
                    if (value) customFields[field.id] = value;
                }
            });

            valids.push({
                id: `contact-import-${Date.now()}-${Math.random()}`,
                firstName: getVal(row, 'firstName').trim(),
                lastName: getVal(row, 'lastName').trim(),
                phoneNumber,
                postalCode: getVal(row, 'postalCode').trim(),
                status: 'pending',
                customFields,
                originalRow: row
            });
        });

        setSummary({ total: csvData.length, valids, invalids });
        setStep(4);
    };

    const handleFinalImport = () => {
        if (!summary) return;
        const contactsToImport = summary.valids.map(({ originalRow, ...contact }) => contact);
        onImport(contactsToImport);
        setStep(5);
    };

    const isNextDisabled = useMemo(() => {
        if (step === 1 && !file) return true;
        if (step === 3 && !mappings['phoneNumber']) return true;
        return false;
    }, [step, file, mappings]);
    
    const usedCsvHeaders = Object.values(mappings);

    const renderStepContent = () => {
        switch (step) {
            case 1: // Upload
                return (
                     <div className="space-y-4">
                        <label className="block w-full cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 text-center hover:border-indigo-500">
                            <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-slate-400" />
                            <span className="mt-2 block text-sm font-medium text-slate-900">{file ? file.name : "Téléverser un fichier (CSV, TXT, XLSX)"}</span>
                            <input type='file' className="sr-only" accept=".csv,.txt,.xlsx" onChange={e => e.target.files && handleFileSelect(e.target.files[0])} />
                        </label>
                        <a href="/contact_template.csv" download className="text-sm text-indigo-600 hover:underline">Télécharger un modèle de fichier CSV</a>
                    </div>
                );
            case 2: // Deduplication
                return (
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-slate-800">Dédoublonnage</h3>
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-md border">
                            <div>
                                <p className="font-medium text-slate-800">Activer le dédoublonnage</p>
                                <p className="text-sm text-slate-500">Vérifie les doublons dans le fichier et avec les contacts existants.</p>
                            </div>
                            <ToggleSwitch enabled={deduplicationConfig.enabled} onChange={e => setDeduplicationConfig(c => ({...c, enabled: e}))} />
                        </div>
                        {deduplicationConfig.enabled && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Critère de dédoublonnage</label>
                                <select value={deduplicationConfig.fieldId} onChange={e => setDeduplicationConfig(c => ({...c, fieldId: e.target.value}))} className="mt-1 w-full p-2 border bg-white rounded-md">
                                    {mappingFields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                );
            case 3: // Mapping
                return (
                     <div className="space-y-3">
                        <p className="text-sm text-slate-600">Faites correspondre les colonnes de votre fichier (à droite) aux champs de destination (à gauche). Le numéro de téléphone est obligatoire.</p>
                        <div className="max-h-80 overflow-y-auto rounded-md border p-2 space-y-2 bg-slate-50">
                            {mappingFields.map(field => (
                                <div key={field.id} className="grid grid-cols-2 gap-4 items-center p-1">
                                    <span className="font-medium text-slate-700 truncate">{field.name} {field.required && <span className="text-red-500">*</span>}</span>
                                    <select value={mappings[field.id] || ''} onChange={e => {
                                            const newCsvHeader = e.target.value;
                                            setMappings(prev => {
                                                const newMappings = { ...prev };
                                                Object.keys(newMappings).forEach(key => { if(newMappings[key] === newCsvHeader) delete newMappings[key]; });
                                                if (newCsvHeader) newMappings[field.id] = newCsvHeader; else delete newMappings[field.id];
                                                return newMappings;
                                            });
                                        }} className="w-full p-2 border bg-white rounded-md"
                                    >
                                        <option value="">Ignorer ce champ</option>
                                        {csvHeaders.map(header => (
                                            <option key={header} value={header} disabled={usedCsvHeaders.includes(header) && mappings[field.id] !== header}>{header}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 4: // Summary
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
                                    <table className="min-w-full"><thead className="bg-slate-200 sticky top-0"><tr className="text-left"><th className="p-2">Ligne</th><th className="p-2">Erreur</th></tr></thead>
                                        <tbody>{summary.invalids.map((item, i) => ( <tr key={i} className="border-t"><td className="p-2 font-mono text-xs">{JSON.stringify(item.row)}</td><td className="p-2 text-red-600">{item.reason}</td></tr> ))}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 5: // Done
                return (
                    <div className="text-center py-8">
                        <CheckIcon className="mx-auto h-16 w-16 text-green-500"/>
                        <h3 className="text-xl font-semibold text-slate-800 mt-4">Importation terminée !</h3>
                        <p className="text-slate-600 mt-2"><span className="font-bold">{summary?.valids.length || 0}</span> contacts ont été ajoutés à la campagne.</p>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[90vh] flex flex-col">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-semibold text-slate-900">Importer des contacts pour : {campaign.name}</h3>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">{renderStepContent()}</div>
                <div className="bg-slate-50 px-6 py-4 flex justify-between rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700">Fermer</button>
                    <div className="flex gap-3">
                        {step > 1 && step < 5 && <button onClick={() => setStep(s => s - 1)} className="rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm hover:bg-slate-50">Retour</button>}
                        {step < 4 && <button onClick={() => step === 3 ? processAndGoToSummary() : setStep(s => s + 1)} disabled={isNextDisabled} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300">
                            {step === 3 ? 'Valider les données' : 'Suivant'} <ArrowRightIcon className="w-4 h-4"/>
                        </button>}
                        {step === 4 && <button onClick={handleFinalImport} className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-green-700">Confirmer et Importer</button>}
                        {step === 5 && <button onClick={onClose} className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700">Terminer</button>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportContactsModal;