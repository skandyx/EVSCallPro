
import React, { useState, useEffect } from 'react';
import type { User, Campaign, Contact, Qualification, SavedScript, QualificationGroup, ContactNote } from '../types.ts';
import { PowerIcon, PhoneIcon, UserCircleIcon, PauseIcon, ChevronDownIcon } from './Icons.tsx';
import AgentPreview from './AgentPreview.tsx';

// A single object to hold all data, makes prop drilling cleaner
interface AgentData {
    campaigns: Campaign[];
    contacts: Contact[];
    qualifications: Qualification[];
    qualificationGroups: QualificationGroup[];
    savedScripts: SavedScript[];
    contactNotes: ContactNote[];
    users: User[];
}
interface AgentViewProps {
    currentUser: User;
    onLogout: () => void;
    data: AgentData;
}

type AgentStatus = 'En Attente' | 'En Appel' | 'En Post-Appel' | 'En Pause';

const AgentView: React.FC<AgentViewProps> = ({ currentUser, onLogout, data }) => {
    const [status, setStatus] = useState<AgentStatus>('En Attente');
    const [statusTimer, setStatusTimer] = useState(0);
    const [currentContact, setCurrentContact] = useState<Contact | null>(null);
    const [currentCampaign, setCurrentCampaign] = useState<Campaign | null>(null);
    const [activeScript, setActiveScript] = useState<SavedScript | null>(null);
    const [selectedQual, setSelectedQual] = useState<string | null>(null);
    
    // Timer effect
    useEffect(() => {
        const interval = setInterval(() => {
            setStatusTimer(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTimer = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };
    
    // Simulate getting a call
    useEffect(() => {
        if (status === 'En Attente' && !currentContact) {
            const timer = setTimeout(() => {
                const campaign = data.campaigns.find(c => c.isActive);
                const contact = campaign?.contacts.find(c => c.status === 'pending');
                if (campaign && contact) {
                    setCurrentCampaign(campaign);
                    setCurrentContact(contact);
                    const script = data.savedScripts.find(s => s.id === campaign.scriptId);
                    setActiveScript(script || null);
                    setStatus('En Appel');
                    setStatusTimer(0);
                }
            }, Math.random() * 5000 + 3000); // New call in 3-8 seconds
            return () => clearTimeout(timer);
        }
    }, [status, currentContact, data.campaigns, data.savedScripts]);

    const handleEndCall = () => {
        if (!selectedQual) {
            alert("Veuillez sélectionner une qualification avant de terminer l'appel.");
            return;
        }
        setStatus('En Post-Appel');
        setStatusTimer(0);
    };

    const handleWrapUp = () => {
        setCurrentContact(null);
        setCurrentCampaign(null);
        setActiveScript(null);
        setSelectedQual(null);
        setStatus('En Attente');
        setStatusTimer(0);
    };

    const qualificationsForCampaign = currentCampaign
        ? data.qualifications.filter(q => q.groupId === currentCampaign.qualificationGroupId || q.isStandard)
        : [];
        
    const contactNotesForCurrentContact = currentContact 
        ? data.contactNotes.filter(note => note.contactId === currentContact.id) 
        : [];

    return (
        <div className="h-screen w-screen flex flex-col font-sans bg-slate-100">
            <header className="flex-shrink-0 bg-white shadow-md p-3 flex justify-between items-center z-10">
                <div className="flex items-center gap-4">
                    <UserCircleIcon className="w-10 h-10 text-slate-400" />
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">Interface Agent</h1>
                        <p className="text-sm text-slate-600">{currentUser.firstName} {currentUser.lastName} - Ext: {currentUser.loginId}</p>
                    </div>
                </div>
                <button onClick={onLogout} className="font-semibold py-2 px-4 rounded-lg inline-flex items-center bg-slate-200 hover:bg-slate-300">
                    <PowerIcon className="w-5 h-5 mr-2" /> Déconnexion
                </button>
            </header>
            
            <main className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
                {/* Left Panel */}
                <div className="col-span-3 flex flex-col gap-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm border flex-1 flex flex-col">
                        <h2 className="text-xl font-semibold text-slate-800 border-b pb-2 mb-4">État de l'Agent</h2>
                        <div className="text-center my-auto">
                            <p className="text-4xl font-bold text-indigo-600">{status}</p>
                            <p className="text-6xl font-mono text-slate-700 mt-2">{formatTimer(statusTimer)}</p>
                        </div>
                        <div className="mt-auto grid grid-cols-2 gap-2">
                            <button className="p-3 bg-slate-200 rounded-lg font-semibold hover:bg-slate-300 disabled:opacity-50" disabled={status === 'En Pause'} onClick={() => {setStatus('En Pause'); setStatusTimer(0);}}>
                                <PauseIcon className="w-5 h-5 mx-auto mb-1" />
                                Pause
                            </button>
                            <button className="p-3 bg-green-100 text-green-800 rounded-lg font-semibold hover:bg-green-200 disabled:opacity-50" disabled={status === 'En Attente'} onClick={handleWrapUp}>
                                <PhoneIcon className="w-5 h-5 mx-auto mb-1" />
                                Prêt
                            </button>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border flex-1">
                        <h2 className="text-xl font-semibold text-slate-800 border-b pb-2 mb-4">Informations Fiche</h2>
                         {currentContact ? (
                            <div className="space-y-2 text-sm">
                                <p><span className="font-semibold">Campagne:</span> {currentCampaign?.name}</p>
                                <p><span className="font-semibold">Nom:</span> {currentContact.firstName} {currentContact.lastName}</p>
                                <p><span className="font-semibold">Téléphone:</span> {currentContact.phoneNumber}</p>
                                <p><span className="font-semibold">Code Postal:</span> {currentContact.postalCode}</p>
                            </div>
                        ) : (
                            <p className="text-slate-500 text-center pt-8">En attente d'un appel...</p>
                        )}
                    </div>
                </div>
                {/* Center Panel */}
                <div className="col-span-6 bg-white rounded-lg shadow-sm border">
                    {activeScript ? (
                        <AgentPreview
                            script={activeScript}
                            onClose={() => {}} 
                            embedded={true}
                            contact={currentContact}
                            contactNotes={contactNotesForCurrentContact}
                            users={data.users}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-500">
                             <p>{currentContact ? "Cette campagne n'a pas de script associé." : "Le script s'affichera ici."}</p>
                        </div>
                    )}
                </div>
                {/* Right Panel */}
                <div className="col-span-3 flex flex-col gap-4">
                     <div className="bg-white p-4 rounded-lg shadow-sm border">
                        <h2 className="text-xl font-semibold text-slate-800 border-b pb-2 mb-4">Contrôles d'Appel</h2>
                        <div className="space-y-2">
                             <button className="w-full p-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 disabled:opacity-50" disabled={status !== 'En Appel'} onClick={handleEndCall}>
                                Terminer l'Appel
                            </button>
                             <button className="w-full p-3 bg-slate-200 font-semibold rounded-lg hover:bg-slate-300 disabled:opacity-50" disabled={status !== 'En Appel'}>Mettre en attente</button>
                            <button className="w-full p-3 bg-slate-200 font-semibold rounded-lg hover:bg-slate-300 disabled:opacity-50" disabled={status !== 'En Appel'}>Transférer</button>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border flex-1 flex flex-col">
                        <h2 className="text-xl font-semibold text-slate-800 border-b pb-2 mb-4">Qualifications</h2>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                           {qualificationsForCampaign.map(q => (
                                <button
                                    key={q.id}
                                    onClick={() => setSelectedQual(q.id)}
                                    disabled={status === 'En Attente'}
                                    className={`w-full text-left p-3 rounded-md border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${selectedQual === q.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-slate-50 border-slate-300'}`}
                                >
                                    [{q.code}] {q.description}
                                </button>
                           ))}
                        </div>
                         <button className="mt-4 w-full p-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50" disabled={status !== 'En Post-Appel'} onClick={handleWrapUp}>
                            Finaliser
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AgentView;
