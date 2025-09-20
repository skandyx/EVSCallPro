
import React, { useState, useMemo } from 'react';
import type { User, UserRole } from '../types.ts';
import { ArrowUpTrayIcon, CheckIcon, XMarkIcon, ArrowRightIcon } from './Icons.tsx';

interface ImportUsersModalProps {
    onClose: () => void;
    onImport: (newUsers: User[]) => void;
    existingUsers: User[];
}

type CsvRow = Record<string, string>;

// Mock CSV data for simulation
const MOCK_CSV_DATA: { headers: string[], data: CsvRow[] } = {
    headers: ["login", "prenom", "nom", "email", "role"],
    data: [
        { login: "2001", prenom: "Import", nom: "Un", email: "import1@example.com", role: "Agent" },
        { login: "2002", prenom: "Import", nom: "Deux", email: "import2@example.com", role: "Agent" },
        { login: "1001", prenom: "Doublon", nom: "Existant", email: "doublon@example.com", role: "Agent" },
        { login: "2003", prenom: "Import", nom: "Trois", email: "", role: "Superviseur" },
        { login: "", prenom: "Invalide", nom: "LoginManquant", email: "invalid@example.com", role: "Agent" },
        { login: "2004", prenom: "Invalide", nom: "RoleInconnu", email: "invalid2@example.com", role: "Manager" },
        { login: "2005", prenom: "Valide", nom: "Quatre", email: "valid4@example.com", role: "Administrateur" },
    ]
};

const USER_ROLES: UserRole[] = ['Agent', 'Superviseur', 'Administrateur', 'SuperAdmin'];

const generatePassword = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = 8;
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};


const ImportUsersModal: React.FC<ImportUsersModalProps> = ({ onClose, onImport, existingUsers }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvData, setCsvData] = useState<CsvRow[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [summary, setSummary] = useState<{ total: number; valids: User[]; invalids: { row: CsvRow; reason: string }[] } | null>(null);

    const MAPPING_FIELDS = [
        { id: 'loginId', name: 'Identifiant / Extension' },
        { id: 'firstName', name: 'Prénom' },
        { id: 'lastName', name: 'Nom' },
        { id: 'email', name: 'Email' },
        { id: 'role', name: 'Rôle' },
    ];

    const handleFileSelect = (selectedFile: File) => {
        setFile(selectedFile);
        // Simulate parsing
        setCsvHeaders(MOCK_CSV_DATA.headers);
        setCsvData(MOCK_CSV_DATA.data);
        // Auto-map obvious fields
        const initialMappings: Record<string, string> = {};
        MOCK_CSV_DATA.headers.forEach(header => {
            const h = header.toLowerCase();
            if (h.includes('login') || h.includes('id')) initialMappings[header] = 'loginId';
            if (h.includes('prénom') || h.includes('first')) initialMappings[header] = 'firstName';
            if (h.includes('nom') || h.includes('last')) initialMappings[header] = 'lastName';
            if (h.includes('email') || h.includes('courriel')) initialMappings[header] = 'email';
            if (h.includes('role')) initialMappings[header] = 'role';
        });
        setMappings(initialMappings);
    };

    const processAndGoToSummary = () => {
        const valids: User[] = [];
        const invalids: { row: CsvRow; reason: string }[] = [];
        const existingLoginIds = new Set(existingUsers.map(u => u.loginId));

        csvData.forEach((row, index) => {
            const getVal = (fieldId: string) => row[Object.keys(mappings).find(h => mappings[h] === fieldId) || ''] || '';
            
            const loginId = getVal('loginId');
            const firstName = getVal('firstName');
            const lastName = getVal('lastName');
            const email = getVal('email');
            const role = getVal('role') as UserRole;

            if (!loginId || !firstName || !lastName) {
                invalids.push({ row, reason: "Champs obligatoires (login, prénom, nom) manquants." });
                return;
            }
            if (existingLoginIds.has(loginId) || valids.some(u => u.loginId === loginId)) {
                invalids.push({ row, reason: `L'identifiant ${loginId} est déjà utilisé.` });
                return;
            }
            if (role && !USER_ROLES.includes(role)) {
                invalids.push({ row, reason: `Rôle '${role}' invalide.` });
                return;
            }

            valids.push({
                id: `new-import-${Date.now() + index}`,
                loginId,
                firstName,
                lastName,
                email,
                role: role || 'Agent',
                isActive: true,
                campaignIds: [],
                password: generatePassword(),
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
                        <p className="text-sm text-slate-600">Faites correspondre les colonnes de votre fichier aux champs de destination. Les champs Prénom, Nom et Identifiant sont obligatoires.</p>
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
                            <div className="bg-green-50 p-4 rounded-md border border-green-200"><p className="text-2xl font-bold text-green-700">{summary.valids.length}</p><p className="text-sm text-green-600">Utilisateurs à créer</p></div>
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
                        <p className="text-slate-600 mt-2"><span className="font-bold">{summary?.valids.length || 0}</span> utilisateurs ont été ajoutés avec succès.</p>
                    </div>
                );
            default: return null;
        }
    };

    const isNextDisabled = useMemo(() => {
        if (step === 1 && !file) return true;
        if (step === 2 && (!mappings['loginId'] || !mappings['firstName'] || !mappings['lastName'])) return true;
        return false;
    }, [step, file, mappings]);

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[90vh] flex flex-col">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-semibold text-slate-900">Importer des utilisateurs par CSV</h3>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">{renderStepContent()}</div>
                <div className="bg-slate-50 px-6 py-4 flex justify-between rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700">Fermer</button>
                    <div className="flex gap-3">
                        {step > 1 && step < 4 && <button onClick={() => setStep(s => s - 1)} className="rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm hover:bg-slate-50">Retour</button>}
                        {step < 3 && <button onClick={() => setStep(s => s + 1)} disabled={isNextDisabled} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300">Suivant <ArrowRightIcon className="w-4 h-4"/></button>}
                        {step === 3 && <button onClick={handleFinalImport} className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-green-700">Confirmer et Importer</button>}
                        {step === 4 && <button onClick={onClose} className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700">Terminer</button>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportUsersModal;
