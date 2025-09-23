
import React, { useState, useEffect, useMemo } from 'react';
import type { User, Campaign, SavedScript, Qualification, Contact, ContactNote, PersonalCallback, UserGroup } from '../types';
import AgentPreview from './AgentPreview';
import { PowerIcon, PhoneIcon, UserCircleIcon, PauseIcon, PlayIcon, InboxArrowDownIcon } from './Icons';

interface AgentViewProps {
    currentUser: User;
    onLogout: () => void;
    data: {
        campaigns: Campaign[];
        savedScripts: SavedScript[];
        qualifications: Qualification[];
        users: User[];
        personalCallbacks: PersonalCallback[];
        userGroups: UserGroup[];
    };
    // Fonctions pour interagir avec l'état global / API
    onRequestNextContact: () => Promise<{ contact: Contact; campaign: Campaign } | null>;
    onSaveContactNote: (note: Omit<ContactNote, 'id' | 'createdAt'>) => Promise<ContactNote>;
}

const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

const AgentView: React.FC<AgentViewProps> = ({ currentUser, onLogout, data, onRequestNextContact, onSaveContactNote }) => {
    const [agentStatus, setAgentStatus] = useState<'READY' | 'ON_CALL' | 'WRAP_UP' | 'PAUSED'>('READY');
    const [callTimer, setCallTimer] = useState(0);
    const [currentContact, setCurrentContact] = useState<Contact | null>(null);
    const [currentCampaign, setCurrentCampaign] = useState<Campaign | null>(null);
    const [currentScript, setCurrentScript] = useState<SavedScript | null>(null);
    const [contactNotes, setContactNotes] = useState<ContactNote[]>([]);
    const [newNote, setNewNote] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // Timer Effect
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (agentStatus === 'ON_CALL') {
            interval = setInterval(() => {
                setCallTimer(prev => prev + 1);
            }, 1000);
        } else {
            setCallTimer(0);
        }
        return () => clearInterval(interval);
    }, [agentStatus]);
    
    const agentCampaigns = useMemo(() => {
        if (!currentUser || !currentUser.campaignIds) return [];
        return data.campaigns.filter(c => currentUser.campaignIds.includes(c.id));
    }, [currentUser, data.campaigns]);


    const handleNextCall = async () => {
        setIsLoading(true);
        const result = await onRequestNextContact();
        if (result) {
            const { contact, campaign } = result;
            setCurrentContact(contact);
            setCurrentCampaign(campaign);
            setCurrentScript(data.savedScripts.find(s => s.id === campaign.scriptId) || null);
            setContactNotes([]); // Reset notes for new contact
            setAgentStatus('ON_CALL');
        } else {
            alert("Plus de contacts disponibles pour le moment.");
        }
        setIsLoading(false);
    };

    const handleSaveNote = async () => {
        if (!newNote.trim() || !currentContact || !currentCampaign) return;
        
        const newNoteData: Omit<ContactNote, 'id' | 'createdAt'> = {
            contactId: currentContact.id,
            agentId: currentUser.id,
            campaignId: currentCampaign.id,
            note: newNote,
        };
        const savedNote = await onSaveContactNote(newNoteData);
        setContactNotes(prev => [savedNote, ...prev]);
        setNewNote('');
    };

    const handleQualifyCall = (qual: Qualification) => {
        // Here you would call the API to save the qualification
        // For now, we simulate the wrap-up state
        alert(`Appel qualifié avec "${qual.description}" (simulation).`);
        setAgentStatus('WRAP_UP');
        // After wrap-up time (from campaign settings), go back to ready
        const wrapUpTime = currentCampaign?.wrapUpTime || 10;
        setTimeout(() => setAgentStatus('READY'), wrapUpTime * 1000);
    };
    
    const qualificationsForCall = currentCampaign 
        ? data.qualifications.filter(q => q.groupId === currentCampaign.qualificationGroupId || q.isStandard)
        : [];

    return (
        <div className="h-screen w-screen bg-slate-100 flex flex-col font-sans">
            <header className="flex-shrink-0 bg-white shadow-sm p-3 flex justify-between items-center z-10">
                 <div className="flex items-center gap-4">
                     <div className="flex items-center">
                        <UserCircleIcon className="w-10 h-10 text-slate-400" />
                        <div className="ml-3">
                            <p className="text-sm font-semibold text-slate-800">{currentUser.firstName} {currentUser.lastName}</p>
                            <p className="text-xs text-slate-500">{currentUser.loginId} - {currentUser.role}</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                     <span className={`px-3 py-1.5 text-sm font-semibold rounded-full ${
                        agentStatus === 'READY' ? 'bg-green-100 text-green-800' :
                        agentStatus === 'ON_CALL' ? 'bg-red-100 text-red-800' :
                        agentStatus === 'WRAP_UP' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-200 text-slate-800'
                     }`}>
                        {agentStatus === 'READY' ? 'En attente' : agentStatus === 'ON_CALL' ? 'En appel' : agentStatus === 'WRAP_UP' ? 'Post-appel' : 'En pause'}
                     </span>
                    <button onClick={onLogout} className="font-semibold py-2 px-4 rounded-lg bg-slate-200 hover:bg-slate-300 inline-flex items-center text-sm">
                        <PowerIcon className="w-4 h-4 mr-2"/> Déconnexion
                    </button>
                </div>
            </header>
            
            <main className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
                <aside className="col-span-3 flex flex-col gap-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm border flex-1 flex flex-col">
                        <h2 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">Contrôles</h2>
                        <div className="flex-1 flex flex-col justify-center items-center gap-4">
                            {agentStatus === 'READY' && (
                                <button onClick={handleNextCall} disabled={isLoading} className="w-48 h-48 bg-green-500 text-white rounded-full flex flex-col items-center justify-center shadow-lg hover:bg-green-600 transition-colors disabled:bg-green-300">
                                    <PhoneIcon className="w-16 h-16"/>
                                    <span className="text-2xl font-bold mt-2">{isLoading ? 'Chargement...' : 'Appel Suivant'}</span>
                                </button>
                            )}
                            {agentStatus === 'ON_CALL' && (
                                <div className="text-center">
                                    <p className="text-slate-500">Appel en cours avec</p>
                                    <p className="text-2xl font-bold">{currentContact?.firstName} {currentContact?.lastName}</p>
                                    <p className="text-5xl font-mono mt-4">{formatDuration(callTimer)}</p>
                                </div>
                            )}
                             {agentStatus === 'WRAP_UP' && (
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-yellow-600">Post-Appel</p>
                                    <p className="text-slate-500">Finalisez vos notes...</p>
                                    <p className="text-4xl font-mono mt-4">{currentCampaign?.wrapUpTime || 10}s</p>
                                </div>
                            )}
                        </div>
                        <div className="mt-auto">
                            {agentStatus !== 'PAUSED' ? (
                                <button onClick={() => setAgentStatus('PAUSED')} className="w-full py-2 px-4 rounded-lg bg-slate-200 hover:bg-slate-300 inline-flex items-center justify-center">
                                    <PauseIcon className="w-5 h-5 mr-2"/> Mettre en pause
                                </button>
                            ) : (
                                <button onClick={() => setAgentStatus('READY')} className="w-full py-2 px-4 rounded-lg bg-green-200 hover:bg-green-300 inline-flex items-center justify-center">
                                    <PlayIcon className="w-5 h-5 mr-2"/> Reprendre les appels
                                </button>
                            )}
                        </div>
                    </div>
                     <div className="bg-white p-4 rounded-lg shadow-sm border h-1/3 flex flex-col">
                        <h2 className="text-lg font-bold text-slate-800 border-b pb-2 mb-2 flex items-center"><InboxArrowDownIcon className="w-5 h-5 mr-2"/>Mes Campagnes</h2>
                        <div className="flex-1 overflow-y-auto space-y-2 text-sm">
                            {agentCampaigns.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-center text-slate-500">Aucune campagne ne vous est assignée.</p>
                                </div>
                            ) : (
                                <ul>
                                    {agentCampaigns.map(c => <li key={c.id} className="font-semibold p-1">{c.name}</li>)}
                                </ul>
                            )}
                        </div>
                    </div>
                </aside>
                
                <div className="col-span-6 bg-white rounded-lg shadow-sm border overflow-hidden">
                     {currentScript && currentContact ? (
                        <AgentPreview
                            script={currentScript}
                            contact={currentContact}
                            contactNotes={contactNotes}
                            users={data.users}
                            newNote={newNote}
                            setNewNote={setNewNote}
                            onSaveNote={handleSaveNote}
                            onClose={() => {}} 
                            embedded 
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400">
                             <p className="text-lg">{ currentContact ? "Aucun script n'est associé à cette campagne." : "Le script d'agent s'affichera ici." }</p>
                        </div>
                    )}
                </div>
                
                <aside className="col-span-3 bg-white p-4 rounded-lg shadow-sm border flex flex-col">
                    <h2 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">Qualifications</h2>
                    <div className="grid grid-cols-1 gap-2 overflow-y-auto">
                        {qualificationsForCall.map(qual => (
                            <button
                                key={qual.id}
                                onClick={() => handleQualifyCall(qual)}
                                disabled={agentStatus !== 'ON_CALL'}
                                className={`w-full p-3 text-left font-semibold rounded-md border transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${
                                    qual.type === 'positive' ? 'bg-green-50 border-green-200 hover:bg-green-100 text-green-800' :
                                    qual.type === 'negative' ? 'bg-red-50 border-red-200 hover:bg-red-100 text-red-800' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                {qual.description}
                            </button>
                        ))}
                    </div>
                </aside>
            </main>
        </div>
    );
};

export default AgentView;
