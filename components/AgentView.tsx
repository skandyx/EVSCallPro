import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { User, Campaign, SavedScript, Contact, Site, PersonalCallback, Qualification, QualificationGroup, ContactNote } from '../types.ts';
import AgentPreview from './AgentPreview.tsx';
import { PhoneIcon, PauseIcon, PlayIcon, UserCircleIcon, PhoneXMarkIcon, PhoneArrowUpRightIcon, BellAlertIcon, InformationCircleIcon, XMarkIcon, CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon } from './Icons.tsx';

type AgentCtiStatus = 'LOGGED_OUT' | 'WAITING' | 'IN_CALL' | 'WRAP_UP' | 'PAUSED';

const CTI_STATUS_CONFIG: { [key in AgentCtiStatus]: { text: string; color: string; } } = {
    LOGGED_OUT: { text: 'Déconnecté', color: 'bg-slate-500' },
    WAITING: { text: 'En attente d\'appel', color: 'bg-green-500' },
    IN_CALL: { text: 'En appel', color: 'bg-red-500' },
    WRAP_UP: { text: 'Post-appel', color: 'bg-yellow-500' },
    PAUSED: { text: 'En pause', color: 'bg-orange-500' },
};

interface AgentViewProps {
    agent: User;
    users: User[];
    campaigns: Campaign[];
    savedScripts: SavedScript[];
    sites: Site[];
    personalCallbacks: PersonalCallback[];
    qualifications: Qualification[];
    qualificationGroups: QualificationGroup[];
    onLogout: () => void;
    apiCall: (url: string, method: string, body?: any) => Promise<any>;
    onSaveContactNote: (contactId: string, campaignId: string, note: string) => Promise<void>;
    onInsertContact: (campaignId: string, contactData: Record<string, any>, phoneNumber: string) => Promise<void>;
    onRequestNextContact: (campaignId: string) => Promise<Contact | null>;
}

const ToastNotification: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => (
    <div className="absolute top-4 right-4 w-full max-w-sm bg-white rounded-lg shadow-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden z-50 animate-fade-in-down">
        <div className="p-4">
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    <InformationCircleIcon className="h-6 w-6 text-blue-500" aria-hidden="true" />
                </div>
                <div className="ml-3 w-0 flex-1 pt-0.5">
                    <p className="text-sm font-semibold text-slate-900">Rappel Programmé</p>
                    <p className="mt-1 text-sm text-slate-600">{message}</p>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                    <button onClick={onClose} className="bg-white rounded-md inline-flex text-slate-400 hover:text-slate-500 focus:outline-none">
                        <span className="sr-only">Close</span>
                        <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </div>
    </div>
);

const DialpadPopover: React.FC<{
    number: string;
    onNumberChange: (newNumber: string) => void;
    onDial: () => void;
    popoverRef: React.RefObject<HTMLDivElement>;
}> = ({ number, onNumberChange, onDial, popoverRef }) => {
    const dialpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

    const handleKeyPress = (key: string) => {
        if (number.length < 15) {
            onNumberChange(number + key);
        }
    };

    const handleClear = () => {
        onNumberChange('');
    };

    const handleDial = () => {
        if (number.trim()) {
            onDial();
        }
    };
    
    return (
        <div ref={popoverRef} className="absolute bottom-full right-0 mb-2 w-64 bg-slate-700 rounded-lg shadow-lg p-4 z-50 text-white">
            <div className="relative mb-2">
                <input type="text" value={number} readOnly className="w-full bg-slate-900 text-white text-xl text-right p-2 rounded-md font-mono" />
                {number && (
                    <button onClick={handleClear} className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1">
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
            <div className="grid grid-cols-3 gap-2">
                {dialpadKeys.map(key => (
                    <button key={key} onClick={() => handleKeyPress(key)} className="py-2 bg-slate-600 rounded-md text-xl font-semibold hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        {key}
                    </button>
                ))}
            </div>
            <button onClick={handleDial} className="mt-3 w-full py-2 bg-green-600 rounded-md text-lg font-bold hover:bg-green-700 flex items-center justify-center disabled:bg-green-400 disabled:cursor-not-allowed" disabled={!number}>
                <PhoneIcon className="w-5 h-5 mr-2" />
                Appeler
            </button>
        </div>
    );
};

const AgentView: React.FC<AgentViewProps> = ({ agent, users, campaigns, savedScripts, sites, personalCallbacks, qualifications, qualificationGroups, onLogout, apiCall, onSaveContactNote, onInsertContact, onRequestNextContact }) => {
    const [ctiStatus, setCtiStatus] = useState<AgentCtiStatus>('LOGGED_OUT');
    const [statusTimer, setStatusTimer] = useState(0);
    const [currentContact, setCurrentContact] = useState<Contact | null>(null);
    const [activeCampaignId, setActiveCampaignId] = useState<string | null>(agent.campaignIds?.[0] || null);
    const [notification, setNotification] = useState<{ id: string, message: string } | null>(null);
    const [shownNotificationIds, setShownNotificationIds] = useState<Set<string>>(new Set());
    const [showBellIndicator, setShowBellIndicator] = useState(false);
    const [selectedQualId, setSelectedQualId] = useState<string | null>(null);
    const [callbackDateTime, setCallbackDateTime] = useState<string>('');

    // State for Contact Notes
    const [contactNotes, setContactNotes] = useState<ContactNote[]>([]);
    const [newNote, setNewNote] = useState('');
    
    // State for Callbacks Popover
    const [isCallbacksPopoverOpen, setIsCallbacksPopoverOpen] = useState(false);
    const [viewedDate, setViewedDate] = useState(new Date());
    const callbacksButtonRef = useRef<HTMLButtonElement>(null);
    const callbacksPopoverRef = useRef<HTMLDivElement>(null);

    // State for Dialpad
    const [isDialpadOpen, setIsDialpadOpen] = useState(false);
    const [dialedNumber, setDialedNumber] = useState('');
    const dialpadButtonRef = useRef<HTMLButtonElement>(null);
    const dialpadPopoverRef = useRef<HTMLDivElement>(null);

    // State for new features
    const [previousActiveCampaignIdBeforeCallback, setPreviousActiveCampaignIdBeforeCallback] = useState<string | null>(null);
    const [wrapUpCountdown, setWrapUpCountdown] = useState<number | null>(null);
    const countdownIntervalRef = useRef<number | null>(null);
    const [isQualified, setIsQualified] = useState(false);

    const agentCampaigns = useMemo(() => {
        // FIX: Add a guard to prevent crash if agent.campaignIds is undefined on initial login.
        if (!agent || !agent.campaignIds) {
            return [];
        }
        return campaigns.filter(c => agent.campaignIds.includes(c.id));
    }, [agent, campaigns]);

    const activeCampaign = useMemo(() => {
        return campaigns.find(c => c.id === activeCampaignId);
    }, [activeCampaignId, campaigns]);

    const agentScript = useMemo(() => {
        if (!activeCampaign?.scriptId) return null;
        return savedScripts.find(s => s.id === activeCampaign.scriptId);
    }, [activeCampaign, savedScripts]);

    // Fetch notes when contact changes
    useEffect(() => {
        const fetchNotes = async () => {
            if (currentContact) {
                try {
                    const notes = await apiCall(`/api/contacts/${currentContact.id}/notes`, 'GET');
                    setContactNotes(notes || []);
                } catch (error) {
                    console.error("Failed to fetch contact notes:", error);
                    setContactNotes([]);
                }
            } else {
                setContactNotes([]);
            }
        };
        fetchNotes();
    }, [currentContact, apiCall]);

    const handleSaveNote = async () => {
        if (!currentContact || !activeCampaignId || !newNote.trim()) return;
        try {
            await onSaveContactNote(currentContact.id, activeCampaignId, newNote);
            setNewNote('');
            // Refetch notes to show the new one
            const updatedNotes = await apiCall(`/api/contacts/${currentContact.id}/notes`, 'GET');
            setContactNotes(updatedNotes || []);
        } catch (error) {
            console.error("Error saving note from AgentView:", error);
        }
    };

    // Effect to handle clicking outside popovers
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                callbacksPopoverRef.current && !callbacksPopoverRef.current.contains(event.target as Node) &&
                callbacksButtonRef.current && !callbacksButtonRef.current.contains(event.target as Node)
            ) {
                setIsCallbacksPopoverOpen(false);
            }
            if (
                dialpadPopoverRef.current && !dialpadPopoverRef.current.contains(event.target as Node) &&
                dialpadButtonRef.current && !dialpadButtonRef.current.contains(event.target as Node)
            ) {
                setIsDialpadOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const viewedDateCallbacks = useMemo(() => {
        const startOfDay = new Date(viewedDate.getFullYear(), viewedDate.getMonth(), viewedDate.getDate()).getTime();
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);

        return personalCallbacks
            .filter(cb => {
                const cbTime = new Date(cb.scheduledTime).getTime();
                return cb.agentId === agent.id && cbTime >= startOfDay && cbTime < endOfDay.getTime();
            })
            .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
    }, [personalCallbacks, agent.id, viewedDate]);


    useEffect(() => {
        if (ctiStatus === 'LOGGED_OUT' || ctiStatus === 'WRAP_UP') {
            setStatusTimer(0);
            return;
        }
        const intervalId = setInterval(() => setStatusTimer(prev => prev + 1), 1000);
        return () => clearInterval(intervalId);
    }, [ctiStatus]);

     useEffect(() => {
        const intervalId = setInterval(() => {
            const now = new Date();
             const todaysCallbacks = personalCallbacks.filter(cb => cb.agentId === agent.id);
            todaysCallbacks.forEach(cb => {
                const cbTime = new Date(cb.scheduledTime);
                const diffMinutes = (cbTime.getTime() - now.getTime()) / 60000;
                
                if (diffMinutes <= 1 && diffMinutes >= -5 && !shownNotificationIds.has(cb.id)) {
                    setNotification({
                        id: cb.id,
                        message: `Vous avez un rappel avec ${cb.contactName} à ${cbTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`
                    });
                    setShownNotificationIds(prev => new Set(prev).add(cb.id));
                    setShowBellIndicator(true);
                }
            });
        }, 15000); // Check every 15 seconds

        return () => clearInterval(intervalId);
    }, [personalCallbacks, agent.id, shownNotificationIds]);

    const handleWrapUpEnd = useCallback(() => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }

        if (previousActiveCampaignIdBeforeCallback) {
            setActiveCampaignId(previousActiveCampaignIdBeforeCallback);
            setPreviousActiveCampaignIdBeforeCallback(null);
        }

        setCtiStatus('WAITING');
        setCurrentContact(null);
        setStatusTimer(0);
        setWrapUpCountdown(null);
        setCallbackDateTime('');
        setIsQualified(false);
    }, [previousActiveCampaignIdBeforeCallback]);

    useEffect(() => {
        if (ctiStatus === 'WRAP_UP' && wrapUpCountdown !== null) {
            countdownIntervalRef.current = window.setInterval(() => {
                setWrapUpCountdown(prev => {
                    if (prev === null || prev <= 1) {
                        handleWrapUpEnd();
                        return null;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
        };
    }, [ctiStatus, wrapUpCountdown, handleWrapUpEnd]);

    useEffect(() => {
        if (selectedQualId !== 'std-94') {
            setCallbackDateTime('');
        }
    }, [selectedQualId]);
    
    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };
    
    const handleLoginClick = () => {
        setCtiStatus('WAITING');
        setStatusTimer(0);
    };

    const startCallSession = (contact: Contact) => {
        setCurrentContact(contact);
        setCtiStatus('IN_CALL');
        setStatusTimer(0);
    };
    
    const handleLaunchCall = async () => {
        if (!activeCampaignId) return;
        
        const lockedContact = await onRequestNextContact(activeCampaignId);

        if (lockedContact) {
            startCallSession(lockedContact);
        } else {
            alert("Plus de contacts disponibles dans cette campagne pour le moment.");
        }
    };

    const handleCallbackCall = (callback: PersonalCallback) => {
        const contact = campaigns.find(c => c.id === callback.campaignId)?.contacts.find(co => co.id === callback.contactId);
        if (!contact) {
            alert("Impossible de trouver les détails du contact pour ce rappel.");
            return;
        }

        setPreviousActiveCampaignIdBeforeCallback(activeCampaignId);
        setActiveCampaignId(callback.campaignId);
        startCallSession(contact);
    };

    const handleManualDial = () => {
        if (!activeCampaignId) {
            alert("Veuillez d'abord sélectionner une campagne pour pouvoir qualifier l'appel.");
            return;
        }
        setIsDialpadOpen(false);

        const manualContact: Contact = {
            id: `manual-${Date.now()}`,
            firstName: 'Appel Manuel',
            lastName: `(${dialedNumber})`,
            phoneNumber: dialedNumber,
            postalCode: '',
            status: 'called',
        };

        startCallSession(manualContact);
        setDialedNumber('');
    };
    
    const handleEndCall = () => {
        setSelectedQualId(null);
        setCallbackDateTime('');
        setIsQualified(false);
        setCtiStatus('WRAP_UP');
    };

    const handlePause = () => {
        setCtiStatus('PAUSED');
        setStatusTimer(0);
    };
    
    const handleResume = () => {
        setCtiStatus('WAITING');
        setStatusTimer(0);
    };

    const handleQualifyAndEndWrapUp = () => {
        const isRappelPersonnel = selectedQualId === 'std-94';
        const isRappelPersonnelInvalid = isRappelPersonnel && (!callbackDateTime || new Date(callbackDateTime) <= new Date());
        
        if (!selectedQualId || isRappelPersonnelInvalid) {
            alert("Veuillez sélectionner une qualification valide et, si nécessaire, une date de rappel future.");
            return;
        }
        
        let logMessage = `Call for contact ${currentContact?.id} qualified with ID: ${selectedQualId}`;
        if(isRappelPersonnel) {
            logMessage += ` with a callback scheduled for ${new Date(callbackDateTime).toLocaleString('fr-FR')}`;
        }
        console.log(logMessage);

        setIsQualified(true);
        setWrapUpCountdown(activeCampaign?.wrapUpTime || 10);
    };
    
    const handleToggleCampaign = (toggledCampaignId: string) => {
        if (currentContact || ctiStatus !== 'WAITING') {
            alert("Veuillez terminer et qualifier la fiche actuelle avant de changer de campagne.");
            return;
        }
    
        const newActiveCampaignId = activeCampaignId === toggledCampaignId ? null : toggledCampaignId;
        setActiveCampaignId(newActiveCampaignId);
    };

    const nextContactToCall = useMemo(() => {
        if (!activeCampaignId) return null;
        const campaign = campaigns.find(c => c.id === activeCampaignId && c.isActive);
        if (!campaign) return null;
        return campaign.contacts.find(c => c.status === 'pending') || null;
    }, [campaigns, activeCampaignId]);

    const handleDateNav = (offset: number) => {
        setViewedDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setDate(newDate.getDate() + offset);
            return newDate;
        });
    };

    const getMinDateTimeLocal = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 1);
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const renderMainPanel = () => {
        if (agentScript && activeCampaign && (ctiStatus === 'IN_CALL' || (ctiStatus === 'WAITING' && currentContact))) {
            return <AgentPreview 
                script={agentScript} 
                onClose={() => {}} 
                embedded={true} 
                contact={currentContact} 
                contactNotes={contactNotes}
                users={users}
                newNote={newNote}
                setNewNote={setNewNote}
                onSaveNote={handleSaveNote}
                campaign={activeCampaign}
                onInsertContact={onInsertContact}
            />;
        }
    
        if (ctiStatus === 'WRAP_UP' && activeCampaign) {
            if (isQualified) {
                return (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-slate-50">
                        <CheckIcon className="w-16 h-16 text-green-500 mb-4" />
                        <h2 className="text-2xl font-semibold text-slate-800">Qualification enregistrée</h2>
                        <p className="text-lg text-slate-500 mt-2">
                            Vous serez disponible pour le prochain appel dans {wrapUpCountdown} seconde{wrapUpCountdown && wrapUpCountdown > 1 ? 's' : ''}...
                        </p>
                    </div>
                );
            }
            
            const qualGroupId = activeCampaign?.qualificationGroupId;
            const campaignQuals = qualifications.filter(q => (qualGroupId && q.groupId === qualGroupId) || q.isStandard);
    
            type TreeQual = Qualification & { children: TreeQual[], level: number };
            const buildTree = (parentId: string | null = null, level = 0): TreeQual[] => {
                return campaignQuals
                    .filter(q => (q.parentId || null) === parentId)
                    .map(q => ({ ...q, children: buildTree(q.id, level + 1), level }))
                    .sort((a,b) => parseInt(a.code) - parseInt(b.code));
            }
            const qualTree = buildTree();
    
            const renderQualTree = (nodes: TreeQual[]) => {
              return nodes.map(q => (
                <React.Fragment key={q.id}>
                  <button 
                    onClick={() => setSelectedQualId(q.id)}
                    style={{ marginLeft: `${q.level * 1.5}rem`}}
                    className={`w-full text-left p-3 rounded-md border text-sm font-medium transition-colors ${selectedQualId === q.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-slate-50'}`}
                  >
                    {q.description}
                  </button>
                   {q.id === 'std-94' && selectedQualId === 'std-94' && (
                    <div 
                      style={{ marginLeft: `${q.level * 1.5}rem`}} 
                      className="p-3 bg-slate-100 rounded-b-md border border-t-0 -mt-1"
                    >
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date et heure du rappel</label>
                      <input 
                        type="datetime-local" 
                        value={callbackDateTime}
                        onChange={e => setCallbackDateTime(e.target.value)}
                        min={getMinDateTimeLocal()}
                        className="w-full p-2 border border-slate-300 rounded-md"
                      />
                    </div>
                  )}
                  {q.children.length > 0 && renderQualTree(q.children)}
                </React.Fragment>
              ))
            }
    
            return (
                <div className="h-full w-full flex flex-col">
                    <header className="p-3 border-b border-slate-200 flex-shrink-0">
                        <h2 className="text-base font-bold text-slate-800 truncate">Qualification de l'appel</h2>
                        <p className="text-xs text-slate-500">Sélectionnez le résultat de votre conversation.</p>
                    </header>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                        {renderQualTree(qualTree)}
                    </div>
                </div>
            );
        }
    
        return (
            <div className="w-full h-full flex items-center justify-center">
                <p className="text-2xl text-slate-400">{CTI_STATUS_CONFIG[ctiStatus].text}</p>
            </div>
        );
    };

    return (
        <div className="h-screen w-screen flex flex-col bg-slate-100 font-sans">
            {notification && <ToastNotification message={notification.message} onClose={() => setNotification(null)} />}
            <header className="bg-white shadow-md p-3 flex justify-between items-center z-40 flex-shrink-0">
                <div className="flex items-center space-x-3">
                    <UserCircleIcon className="w-10 h-10 text-slate-500" />
                    <div>
                        <p className="font-bold text-slate-800">{agent.firstName} {agent.lastName}</p>
                        <p className="text-sm text-slate-500">Rôle: {agent.role}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="relative">
                        <button onClick={() => setShowBellIndicator(false)} className="p-2 rounded-full hover:bg-slate-100">
                           <BellAlertIcon className="w-6 h-6 text-slate-500" />
                        </button>
                         {showBellIndicator && <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full ring-2 ring-white bg-red-500" />}
                    </div>
                    <div className="relative">
                        <button
                            ref={callbacksButtonRef}
                            onClick={() => setIsCallbacksPopoverOpen(prev => !prev)}
                            className="p-2 rounded-full hover:bg-slate-100"
                        >
                           <CalendarDaysIcon className="w-6 h-6 text-slate-500" />
                        </button>
                    </div>
                    <button onClick={onLogout} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg">
                        Déconnexion
                    </button>
                </div>
            </header>
            
            <main className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden relative">
                {isCallbacksPopoverOpen && (
                    <div ref={callbacksPopoverRef} className="absolute top-0 right-4 w-full max-w-sm bg-white rounded-lg shadow-lg border border-slate-200 z-30 flex flex-col">
                        <div className="p-3 border-b border-slate-200">
                             <div className="flex items-center justify-between">
                                <button onClick={() => handleDateNav(-1)} className="p-1 rounded-full hover:bg-slate-100"><ChevronLeftIcon className="w-5 h-5"/></button>
                                <div className="text-center">
                                    <p className="font-semibold text-slate-700">{viewedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                </div>
                                <button onClick={() => handleDateNav(1)} className="p-1 rounded-full hover:bg-slate-100"><ChevronRightIcon className="w-5 h-5"/></button>
                            </div>
                        </div>
                        <div className="p-3 space-y-2 overflow-y-auto max-h-96">
                            {viewedDateCallbacks.length > 0 ? viewedDateCallbacks.map(cb => (
                                <div key={cb.id} className="p-2 bg-slate-50 rounded-md border flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-sm text-slate-800">{cb.contactName}</p>
                                        <p className="text-xs text-slate-500">{new Date(cb.scheduledTime).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})} - {cb.notes}</p>
                                    </div>
                                     <button 
                                        onClick={() => handleCallbackCall(cb)} 
                                        className="bg-green-100 hover:bg-green-200 text-green-800 font-semibold py-1 px-2 rounded-md text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={ctiStatus !== 'WAITING'}
                                        title={ctiStatus !== 'WAITING' ? `Action indisponible (Statut: ${CTI_STATUS_CONFIG[ctiStatus].text})` : "Lancer l'appel"}
                                     >
                                        Appeler
                                    </button>
                                </div>
                            )) : <p className="text-sm text-slate-500 italic text-center py-4">Aucun rappel pour ce jour.</p>}
                        </div>
                    </div>
                )}
                <div className="col-span-3 bg-white rounded-lg p-4 border border-slate-200 flex flex-col gap-4 overflow-y-auto">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-800 border-b pb-2 mb-4">Mes Campagnes</h2>
                        <div className="space-y-3">
                            {agentCampaigns.map(campaign => (
                                <div key={campaign.id} className="flex items-center justify-between">
                                    <span className={`font-semibold ${activeCampaignId === campaign.id ? 'text-slate-800' : 'text-slate-400'}`}>{campaign.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleCampaign(campaign.id)}
                                        className={`${activeCampaignId === campaign.id ? 'bg-indigo-600' : 'bg-slate-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`}
                                        role="switch"
                                        aria-checked={activeCampaignId === campaign.id}
                                    >
                                        <span className={`${activeCampaignId === campaign.id ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {ctiStatus === 'WAITING' && nextContactToCall && (
                        <div className="bg-slate-50 p-3 rounded-lg border">
                            <h3 className="font-semibold text-slate-600">Prochain contact à appeler</h3>
                            <p className="text-lg text-slate-800 font-bold">{nextContactToCall.firstName} {nextContactToCall.lastName}</p>
                            <div className="flex items-center justify-between mt-2">
                                <p className="text-md text-slate-600 font-mono">{nextContactToCall.phoneNumber}</p>
                                <button onClick={handleLaunchCall} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-3 rounded-md inline-flex items-center text-sm">
                                    <PhoneArrowUpRightIcon className="w-4 h-4 mr-2"/> Lancer l'appel
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {currentContact && (ctiStatus === 'IN_CALL' || ctiStatus === 'WRAP_UP') && (
                        <div className="bg-slate-50 p-3 rounded-lg border">
                            <h3 className="font-semibold text-slate-600">Contact en cours</h3>
                            <p className="text-lg text-slate-800 font-bold">{currentContact.firstName} {currentContact.lastName}</p>
                            <p className="text-md text-slate-600">{currentContact.phoneNumber}</p>
                            {currentContact.postalCode && <p className="text-sm text-slate-500">Code Postal: {currentContact.postalCode}</p>}
                        </div>
                    )}
                </div>
                <div className="col-span-9 bg-white rounded-lg border border-slate-200 overflow-hidden relative">
                   {renderMainPanel()}
                </div>
            </main>

            <footer className="bg-slate-800 text-white p-3 flex justify-between items-center flex-shrink-0 relative">
                <div className="flex items-center space-x-4">
                    <div className={`px-4 py-2 rounded-md flex items-center ${CTI_STATUS_CONFIG[ctiStatus].color}`}>
                        <span className="font-bold">
                            {ctiStatus === 'WRAP_UP' && isQualified
                                ? `${CTI_STATUS_CONFIG[ctiStatus].text} (${wrapUpCountdown}s)`
                                : CTI_STATUS_CONFIG[ctiStatus].text}
                        </span>
                    </div>
                    <div className="font-mono text-2xl">{formatDuration(statusTimer)}</div>
                </div>
                <div className="flex items-center space-x-2">
                    {ctiStatus === 'LOGGED_OUT' && (
                        <button onClick={handleLoginClick} className="bg-green-600 hover:bg-green-700 font-semibold py-2 px-4 rounded-lg inline-flex items-center"><PlayIcon className="w-5 h-5 mr-2"/>Démarrer la session</button>
                    )}
                    {ctiStatus === 'WAITING' && (
                        <>
                            <button
                                ref={dialpadButtonRef}
                                onClick={() => setIsDialpadOpen(prev => !prev)}
                                className="bg-slate-600 hover:bg-slate-700 font-semibold py-2 px-4 rounded-lg inline-flex items-center"
                            >
                                <PhoneArrowUpRightIcon className="w-5 h-5 mr-2"/>
                                Composer
                            </button>
                            <button onClick={handlePause} className="bg-slate-600 hover:bg-slate-700 font-semibold py-2 px-4 rounded-lg inline-flex items-center"><PauseIcon className="w-5 h-5 mr-2"/>Pause</button>
                        </>
                    )}
                     {ctiStatus === 'PAUSED' && (
                        <button onClick={handleResume} className="bg-green-600 hover:bg-green-700 font-semibold py-2 px-4 rounded-lg inline-flex items-center"><PlayIcon className="w-5 h-5 mr-2"/>Reprendre</button>
                    )}
                    {ctiStatus === 'IN_CALL' && (
                        <button onClick={handleEndCall} className="bg-red-600 hover:bg-red-700 font-semibold py-2 px-4 rounded-lg inline-flex items-center"><PhoneXMarkIcon className="w-5 h-5 mr-2"/>Raccrocher</button>
                    )}
                    {ctiStatus === 'WRAP_UP' && (
                        !isQualified ? (
                            (() => {
                                const isRappelPersonnel = selectedQualId === 'std-94';
                                const isRappelPersonnelInvalid = isRappelPersonnel && (!callbackDateTime || new Date(callbackDateTime) <= new Date());
                                const isDisabled = !selectedQualId || isRappelPersonnelInvalid;

                                return (
                                    <button onClick={handleQualifyAndEndWrapUp} disabled={isDisabled} className="bg-green-600 hover:bg-green-700 font-semibold py-2 px-4 rounded-lg inline-flex items-center disabled:bg-green-300 disabled:cursor-not-allowed">
                                        <CheckIcon className="w-5 h-5 mr-2"/>Valider la qualification
                                    </button>
                                );
                            })()
                        ) : (
                            <div className="font-semibold py-2 px-4">Enregistrement...</div>
                        )
                    )}
                </div>
                 {isDialpadOpen && <DialpadPopover
                    number={dialedNumber} 
                    onNumberChange={setDialedNumber} 
                    onDial={handleManualDial}
                    popoverRef={dialpadPopoverRef}
                 />}
            </footer>
        </div>
    );
};

export default AgentView;
