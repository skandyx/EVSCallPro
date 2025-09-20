# Détails du Projet : Architecte de Solutions de Centre de Contact

Ce document fournit une vue d'ensemble détaillée des fonctionnalités de l'application, de son état actuel et de la feuille de route pour les développements futurs.

## 1. État Actuel : Fonctionnalités Implémentées

L'application est actuellement une maquette fonctionnelle très avancée, opérant avec des données de test (`mock data`). Elle intègre une gestion des rôles (Administrateur, Superviseur, Agent) et propose les modules suivants :

### A. Monitoring
Un tableau de bord technique pour surveiller la santé de l'infrastructure en temps réel (simulé).
- **Indicateur de santé global** (UP, DEGRADED, DOWN).
- **Métriques serveur** : Jauges pour le CPU, la RAM, le disque et graphique de latence API.
- **Journal des événements** : Affichage des logs système (INFO, WARNING, ERROR).
- **Informations de version** des différents composants (frontend, backend, etc.).
- **Testeur de connectivité** pour les services critiques (BDD, API, Téléphonie).

### B. Supervision
Un centre de commandement pour le pilotage en temps réel de l'activité. Les données sont actualisées dynamiquement pour simuler un flux WebSocket.
- **Navigation par onglets** : Live, Agents, Appels, Campagnes.
- **Live Dashboard** : KPIs principaux (agents par état, alertes intelligentes).
- **Agent Board** : Tableau détaillé de l'état des agents avec leurs KPIs et des boutons d'actions de supervision (Écouter, Intervenir, Coacher, Forcer la pause/déconnexion).
- **Call Board** : Liste des appels actifs avec actions possibles (Monitorer, Transférer, Raccrocher).
- **Campaign Board** : Vue des campagnes actives avec actions rapides (Pause, Stop, Boost).

### C. Reporting
Un module d'analyse de la performance avec des filtres puissants et des exports professionnels.
- **Filtres dynamiques** par période, campagne et agent.
- **KPIs interactifs** et calculés en fonction des filtres.
- **Navigation par onglets** : Graphiques, Feuille de Temps, Par Campagne, Par Agent, Historique.
- **Graphiques** : Visualisations du volume d'appels, répartition par campagne, taux de succès et adhérence.
- **Feuille de Temps** : Analyse détaillée des sessions des agents, calcul de l'adhérence au planning.
- **Export PDF** : Génération d'un rapport multi-pages professionnel incluant KPIs, analyses et journaux.

### D. Gestion des Agents
- **Utilisateurs** : Création, modification, suppression des utilisateurs. Gestion des rôles, assignation aux campagnes, génération de mots de passe.
- **Groupes** : Création de groupes d'agents pour faciliter l'assignation et l'analyse.

### E. Configuration Outbound (Sortant)
- **Scripts d'agent** : Un éditeur visuel complet en glisser-déposer pour créer des scripts multi-pages avec logique conditionnelle.
- **Campagnes Sortantes** : Module de configuration avancé avec une interface à onglets :
    - **Général** : Nom, priorité, mode de numérotation, script, groupe de qualifications.
    - **Planification** : Fuseau horaire, jours et heures d'appel.
    - **Stratégie** : Paramètres prédictifs, gestion des tentatives de rappel par statut, détection de répondeur.
    - **Qualité & Conformité** : Enregistrement, bip légal, durées maximales.

### F. Configuration Inbound (Entrant)
- **Flux SVI** : Un éditeur visuel en glisser-déposer pour construire des parcours vocaux interactifs (SVI), avec des nœuds logiques (Menu, Média, Calendrier, Transfert, etc.).

### G. Paramètres Généraux
- **Qualifications** : Gestion des qualifications d'appel et de leurs groupes.
- **Trunks SIP** : Configuration des connexions aux fournisseurs de téléphonie.
- **Numéros SDA** : Assignation des numéros entrants aux flux SVI.
- **Maintenance & Sauvegardes** : Lancement de sauvegardes manuelles et planification de sauvegardes automatiques.

## 2. Feuille de Route : Points Restants

Pour transformer cette maquette en une solution de production, les prochaines étapes sont principalement axées sur le développement du backend et la connexion des deux parties.

1.  **Développement de l'API Backend**
    - Créer les endpoints REST (ou GraphQL) pour toutes les opérations CRUD (Create, Read, Update, Delete) sur l'ensemble des entités : utilisateurs, groupes, campagnes, scripts, SVI, etc.
    - Implémenter la logique de sauvegarde et de récupération des données dans la base de données PostgreSQL.

2.  **Connexion du Frontend à l'API**
    - Remplacer toutes les interactions avec les données de test (`mockData.ts`) par des appels à l'API du backend.
    - Gérer les états de chargement, les succès et les erreurs des appels API.

3.  **Implémentation du WebSocket pour le Temps Réel**
    - **Côté Backend** : Mettre en place un serveur WebSocket qui diffuse en continu les événements du centre de contact (changements d'état d'agent, nouveaux appels, KPIs de campagne).
    - **Côté Frontend** : Connecter les modules de Supervision et de Monitoring au WebSocket pour afficher des données véritablement en temps réel.

4.  **Finalisation de l'Intégration Téléphonique (Asterisk)**
    - Valider et enrichir les scripts AGI du backend pour couvrir tous les cas d'usage des nœuds SVI.
    - Mettre en place la logique de composition d'appels pour les campagnes sortantes, en respectant les modes de numérotation (prédictif, progressif).

5.  **Fonctionnalités Avancées**
    - **Module Qualité (QA)** : Développer l'interface de notation des enregistrements mentionnée dans les spécifications.
    - **Alertes** : Implémenter le système d'alertes (notifications Slack, SMS, PagerDuty) via le backend.
    - **Authentification Sécurisée** : Remplacer la gestion actuelle des mots de passe par un système robuste (ex: JWT, OAuth) avec hashage des mots de passe.
