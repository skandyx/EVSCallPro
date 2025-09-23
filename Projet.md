# Détails du Projet : Architecte de Solutions de Centre de Contact

Ce document fournit une vue d'ensemble détaillée des fonctionnalités de l'application, de son état actuel et de la feuille de route pour les développements futurs.

## 1. État Actuel (Post-Refactorisation Backend)

L'application a dépassé le stade de simple maquette pour devenir un prototype doté de fondations backend robustes et prêtes pour la production. L'interface frontend reste fonctionnelle avec des données de test, tandis que le backend et la base de données ont été finalisés sur le plan architectural.

### A. Fondations Backend & Données (COMPLET)
- **Base de Données (PostgreSQL)** : Le schéma est complet, normalisé et optimisé. Il couvre toutes les entités de l'application (CDR, utilisateurs, campagnes, etc.) et est prêt à stocker des données réelles.
- **Serveur Backend (Node.js)** : La structure du serveur est en place, avec une gestion modulaire des requêtes à la base de données, un serveur web Express et un serveur WebSocket.
- **Scripts d'Initialisation** : Les scripts `database.txt` (schéma) et `seed.txt` (données initiales) permettent une initialisation rapide et reproductible de l'environnement.

### B. Architecture de Téléphonie Centralisée (COMPLET)
L'application supporte désormais une architecture de téléphonie centralisée, évolutive et standard de l'industrie.
- **Double Mode de Connexion** : Le backend peut opérer de deux manières, sélectionnables via la variable d'environnement `PBX_CONNECTION_MODE` :
    1.  **`YEASTAR_API`** : Mode hérité pour piloter directement les PBX Yeastar via leur API.
    2.  **`ASTERISK_AMI`** : Mode recommandé où le backend pilote un unique Asterisk central, offrant un contrôle et une flexibilité maximum.
- **Configuration Asterisk Complète** : Tous les fichiers de configuration pour Asterisk sont générés, gérant les trunks vers les sites, les contextes d'appels entrants/sortants et l'interface de management (AMI).
- **Scripts de Déploiement** : Les scripts `apply-asterisk-config.sh` et `addSiteTrunk.sh` automatisent et sécurisent le déploiement et la maintenance de la configuration de téléphonie.

---

## 2. Analyse : Le Pont Manquant entre Frontend et Backend

À ce stade, nous avons une interface utilisateur riche et un moteur backend puissant, mais ils ne communiquent pas encore entre eux. **Le frontend fonctionne toujours de manière isolée sur des données de démonstration (`mockData.ts`).**

La pièce manquante est le **"pont" applicatif** : une **API REST complète** côté backend.

- **Backend** : Possède la logique pour lire/écrire dans la base de données (ex: `user.queries.js`).
- **Frontend** : Possède les interfaces pour afficher/modifier les utilisateurs.
- **API (à construire)** : Doit exposer la logique du backend via des "routes" (ex: `GET /api/users`, `POST /api/users`) que le frontend pourra appeler pour remplacer les données fictives par des données réelles.

---

## 3. Feuille de Route Finale : Du Prototype à la Production

Voici les étapes concrètes et priorisées pour finaliser l'application.

### Phase 1 : Connexion (Priorité 1 - Chemin Critique)
*Objectif : Rendre l'application entièrement pilotée par les données de la base de données.*

1.  **Développement de l'API Backend (CRUD)**
    - ✅ **Utilisateurs & Groupes** : Créer les endpoints `GET`, `POST`, `PUT`, `DELETE` pour `/api/users` et `/api/groups`.
    - ✅ **Campagnes & Contacts** : Endpoints pour gérer les campagnes et l'import/gestion des contacts.
    - ✅ **Scripts & SVI** : Endpoints pour sauvegarder et charger les configurations JSON des éditeurs visuels.
    - ✅ **Qualifications** : Endpoints pour la gestion des qualifications et de leurs groupes.
    - ✅ **Paramètres** : Endpoints pour toutes les configurations (Trunks, SDA, Sites, etc.).

2.  **Intégration Frontend**
    - **Remplacer `mockData.ts`** : Modifier chaque composant (`UserManager`, `CampaignManager`, etc.) pour qu'il appelle l'API via la fonction `apiCall` au lieu de lire les données locales.
    - **Gestion d'État** : Utiliser `useEffect` pour charger les données au montage des composants et rafraîchir la vue après chaque opération de sauvegarde ou de suppression.

### Phase 2 : Temps Réel & Sécurité (Priorité 2 - Préparation Production)
*Objectif : Activer la supervision temps réel et sécuriser l'application.*

1.  **Implémentation du WebSocket pour la Supervision**
    - **Backend** : Finaliser le `AmiListener` pour qu'il parse les événements AMI d'Asterisk (AgentConnect, Hangup, etc.) et les diffuse via le serveur WebSocket (`wss`) au format JSON attendu par le frontend.
    - **Frontend** : Connecter le `SupervisionDashboard` au WebSocket pour recevoir les événements et mettre à jour l'interface en temps réel, en supprimant la simulation `setInterval`.

2.  **Sécurisation de l'Application**
    - **Authentification Robuste** : Remplacer la gestion de session en mémoire par un système basé sur **JWT (JSON Web Tokens)**. Le backend générera un token à la connexion, et le frontend le stockera de manière sécurisée pour l'inclure dans chaque requête API.
    - **Autorisation par Rôle** : Implémenter des middlewares sur l'API backend pour vérifier le rôle de l'utilisateur (contenu dans le JWT) avant d'autoriser l'accès à un endpoint (ex: seul un 'Administrateur' peut appeler `POST /api/users`).

### Phase 3 : Robustesse & Qualité (Priorité 3 - Viabilité à long terme)
*Objectif : Garantir la fiabilité, la maintenabilité et la finition de l'application.*

1.  **Mise en Place des Tests Automatisés**
    - **Tests Unitaires (Backend)** : Utiliser Jest pour tester la logique métier critique (ex: calculs de rapports, validation de données).
    - **Tests d'Intégration (Backend)** : Utiliser Jest & Supertest pour tester les endpoints de l'API, en simulant des requêtes et en vérifiant les réponses et les modifications en base de données.
    - **Tests End-to-End (Frontend)** : Mettre en place Cypress ou Playwright pour simuler des parcours utilisateurs complets dans le navigateur (ex: "se connecter, créer une campagne, y ajouter un contact, puis la supprimer").

2.  **Pipeline CI/CD (Intégration et Déploiement Continus)**
    - Configurer un service (ex: GitHub Actions) pour lancer automatiquement la suite de tests à chaque `push`.
    - Automatiser le déploiement sur le serveur de production si les tests réussissent.

3.  **Finalisation des Fonctionnalités Avancées**
    - Implémenter la logique métier pour les alertes, les sauvegardes et le module de QA (notation des enregistrements).
    - Réaliser un audit de performance sur les requêtes de reporting avec de grands volumes de données et optimiser si nécessaire.
