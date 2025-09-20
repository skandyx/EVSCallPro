import React from 'react';
import type { Feature } from '../types.ts';
import { ServerStackIcon } from './Icons.tsx';

interface ApiDocsProps {
    feature: Feature;
}

const EndpointDoc: React.FC<{
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
    description: string;
    body?: any;
    response?: any;
}> = ({ method, url, description, body, response }) => {
    const methodColors = {
        GET: 'bg-sky-100 text-sky-700',
        POST: 'bg-green-100 text-green-700',
        PUT: 'bg-amber-100 text-amber-700',
        DELETE: 'bg-red-100 text-red-700',
    };

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 bg-slate-50 border-b">
                <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-md text-sm font-bold ${methodColors[method]}`}>{method}</span>
                    <span className="font-mono text-slate-800">{url}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{description}</p>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
                <div>
                    <h4 className="font-semibold text-sm text-slate-700 mb-2">Exemple de Requête</h4>
                    {body ? (
                        <pre className="bg-slate-800 text-white p-3 rounded-md text-xs overflow-x-auto">
                            <code>{JSON.stringify(body, null, 2)}</code>
                        </pre>
                    ) : <p className="text-xs text-slate-500 italic">Aucun corps de requête.</p>}
                </div>
                <div>
                    <h4 className="font-semibold text-sm text-slate-700 mb-2">Exemple de Réponse (Succès 200/201)</h4>
                     {response ? (
                        <pre className="bg-slate-800 text-white p-3 rounded-md text-xs overflow-x-auto">
                            <code>{JSON.stringify(response, null, 2)}</code>
                        </pre>
                    ) : <p className="text-xs text-slate-500 italic">Aucun contenu en réponse (Succès 204).</p>}
                </div>
            </div>
        </div>
    );
};

const ApiSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-800 border-b pb-2">{title}</h2>
        <div className="space-y-4">
            {children}
        </div>
    </div>
);


const ApiDocs: React.FC<ApiDocsProps> = ({ feature }) => {
    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight flex items-center">
                    <ServerStackIcon className="w-9 h-9 mr-3 text-indigo-600"/>
                    {feature.title}
                </h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            
            <div className="space-y-12">
                <ApiSection title="Utilisateurs">
                    <EndpointDoc method="GET" url="/api/users" description="Récupère la liste de tous les utilisateurs." response={[{ id: "user-admin", loginId: "9000", firstName: "Admin", "..." : "..." }]} />
                    <EndpointDoc method="POST" url="/api/users" description="Crée un nouvel utilisateur et gère son appartenance aux groupes." body={{ user: { loginId: "1004", "..." : "..." }, groupIds: ["group-1"] }} response={{ id: "user-new", loginId: "1004", "..." : "..." }} />
                    <EndpointDoc method="PUT" url="/api/users/:id" description="Met à jour un utilisateur existant." body={{ user: { id: "user-1", "..." : "..." }, groupIds: ["group-1", "group-2"] }} response={{ id: "user-1", "..." : "..." }} />
                    <EndpointDoc method="DELETE" url="/api/users/:id" description="Supprime un utilisateur." />
                </ApiSection>

                <ApiSection title="Groupes d'Utilisateurs">
                    <EndpointDoc method="GET" url="/api/groups" description="Récupère la liste de tous les groupes d'utilisateurs." response={[{ id: "group-1", name: "Ventes", memberIds: ["user-1"] }]} />
                    <EndpointDoc method="POST" url="/api/groups" description="Crée un nouveau groupe d'utilisateurs." body={{ name: "Support", memberIds: ["user-2"] }} response={{ id: "group-new", name: "Support", memberIds: ["user-2"] }} />
                    <EndpointDoc method="PUT" url="/api/groups/:id" description="Met à jour un groupe existant." body={{ id: "group-1", name: "Ventes France", memberIds: ["user-1", "user-3"] }} response={{ id: "group-1", name: "Ventes France", "..." : "..." }} />
                    <EndpointDoc method="DELETE" url="/api/groups/:id" description="Supprime un groupe d'utilisateurs." />
                </ApiSection>
                
                <ApiSection title="Campagnes">
                    <EndpointDoc method="GET" url="/api/campaigns" description="Récupère la liste de toutes les campagnes." response={[{ id: "campaign-1", name: "Ventes T4", "..." : "..." }]} />
                    <EndpointDoc method="POST" url="/api/campaigns" description="Crée une nouvelle campagne." body={{ name: "Nouvelle Campagne", "..." : "..." }} response={{ id: "campaign-new", "..." : "..." }} />
                    <EndpointDoc method="PUT" url="/api/campaigns/:id" description="Met à jour une campagne existante." body={{ id: "campaign-1", name: "Ventes T4 (Mise à jour)", "..." : "..." }} response={{ id: "campaign-1", "..." : "..." }} />
                    <EndpointDoc method="DELETE" url="/api/campaigns/:id" description="Supprime une campagne." />
                    <EndpointDoc method="POST" url="/api/campaigns/:id/contacts" description="Importe une liste de contacts dans une campagne existante." body={{ contacts: [{ firstName: "John", "..." : "..." }] }} response={{ message: "Contacts imported successfully" }} />
                </ApiSection>

                <ApiSection title="Scripts d'Agent">
                    <EndpointDoc method="GET" url="/api/scripts" description="Récupère la liste de tous les scripts." response={[{ id: "script-1", name: "Script Vente", pages: "[...]" }]} />
                    <EndpointDoc method="POST" url="/api/scripts" description="Crée un nouveau script." body={{ name: "Nouveau Script", pages: "[...]" }} response={{ id: "script-new", "..." : "..." }} />
                    <EndpointDoc method="PUT" url="/api/scripts/:id" description="Met à jour un script existant." body={{ id: "script-1", name: "Script Vente v2", "..." : "..." }} response={{ id: "script-1", "..." : "..." }} />
                    <EndpointDoc method="DELETE" url="/api/scripts/:id" description="Supprime un script." />
                </ApiSection>

                <ApiSection title="Flux SVI">
                    <EndpointDoc method="GET" url="/api/ivr-flows" description="Récupère la liste de tous les flux SVI." response={[{ id: "ivr-1", name: "SVI Principal", nodes: "[...]" }]} />
                    <EndpointDoc method="POST" url="/api/ivr-flows" description="Crée un nouveau flux SVI." body={{ name: "Nouveau SVI", nodes: "[...]" }} response={{ id: "ivr-new", "..." : "..." }} />
                    <EndpointDoc method="PUT" url="/api/ivr-flows/:id" description="Met à jour un flux SVI existant." body={{ id: "ivr-1", name: "SVI Principal v2", "..." : "..." }} response={{ id: "ivr-1", "..." : "..." }} />
                    <EndpointDoc method="DELETE" url="/api/ivr-flows/:id" description="Supprime un flux SVI." />
                </ApiSection>

                 <ApiSection title="Qualifications">
                    <EndpointDoc method="GET" url="/api/qualifications" description="Récupère toutes les qualifications." response={[{ id: "qual-1", code: "100", description: "Vente" }]} />
                    <EndpointDoc method="POST" url="/api/qualifications" description="Crée une nouvelle qualification." body={{ code: "101", description: "Rappel" }} response={{ id: "qual-new", "..." : "..." }} />
                    <EndpointDoc method="GET" url="/api/qualification-groups" description="Récupère tous les groupes de qualifications." response={[{ id: "qg-1", name: "Ventes" }]} />
                    <EndpointDoc method="POST" url="/api/qualification-groups" description="Crée un nouveau groupe et assigne des qualifications." body={{ group: { name: "Support" }, assignedQualIds: ["qual-1", "qual-2"] }} response={{ id: "qg-new", "..." : "..." }} />
                </ApiSection>

                <ApiSection title="Paramètres de Téléphonie">
                     <EndpointDoc method="GET" url="/api/trunks" description="Récupère tous les Trunks SIP." response={[{ id: "trunk-1", name: "Opérateur A" }]} />
                     <EndpointDoc method="POST" url="/api/trunks" description="Crée un nouveau Trunk SIP." body={{ name: "Opérateur B", "..." : "..." }} response={{ id: "trunk-new", "..." : "..." }} />
                     <EndpointDoc method="GET" url="/api/dids" description="Récupère tous les numéros (SDA)." response={[{ id: "did-1", number: "0123456789" }]} />
                     <EndpointDoc method="POST" url="/api/dids" description="Crée un nouveau numéro (SDA)." body={{ number: "0987654321", "..." : "..." }} response={{ id: "did-new", "..." : "..." }} />
                </ApiSection>
            </div>
        </div>
    );
};

export default ApiDocs;