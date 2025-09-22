# Guide de Configuration Yeastar pour Intégration CRM Multi-Site

Ce document est une check-list pour les administrateurs système et réseau afin de préparer un PBX Yeastar (S-Series) à être intégré avec le CRM EVSCallPro dans une configuration multi-site.

## 1. Prérequis Réseau (pour chaque site)

- [ ] **VPN Opérationnel** : Un tunnel VPN (Site-to-Site ou client OpenVPN sur le Yeastar) doit être établi et stable entre le site distant et le réseau du serveur CRM central.
- [ ] **Routage Correct** : Le Yeastar PBX (`10.x.0.254`) doit être capable de joindre l'adresse IP du serveur CRM via le VPN.
- [ ] **Flux Réseau Autorisés** :
  - Le trafic **HTTP/HTTPS** du CRM vers le Yeastar (`TCP 80/443`) doit être autorisé.
  - Le trafic de retour du Yeastar vers le CRM doit être autorisé.
  - (Optionnel pour webhooks) Le trafic **HTTP/HTTPS** du Yeastar vers le CRM (`TCP 80/443`) doit être autorisé.

---

## 2. Configuration du Yeastar PBX (pour chaque site)

### 2.1. Activation et Configuration de l'API

1.  **Connexion** : Accédez à l'interface web d'administration du Yeastar.
2.  **Navigation** : Allez dans `Paramètres > API`.
3.  **Activation** : Cochez la case "Activer l'API".
4.  **Création Utilisateur API** :
    - [ ] Cliquer sur `Ajouter`.
    - [ ] **Nom d'utilisateur** : Créer un nom explicite (ex: `crm_api_user`).
    - [ ] **Mot de passe** : Créer un mot de passe fort.
    - [ ] **Noter ces identifiants** : ils seront utilisés dans le script `addPbxSite.sh`.
5.  **Permissions API** :
    - [ ] Sélectionner l'utilisateur API créé.
    - [ ] **Permissions Requises** :
        - `Originate` (Appel) : **Obligatoire** pour le Click-to-Call.
        - `Extension` (Status des extensions) : **Obligatoire** pour la supervision.
        - `CDR` (Rapports d'appels) : **Obligatoire** pour la supervision.
        - `Recording` (Enregistrement) : **Obligatoire** pour récupérer les enregistrements.
        - `Hangup` (Raccrocher) : Recommandé pour la supervision.
6.  **Sécurité de l'Accès API** :
    - [ ] **IPs Autorisées** : Dans ce champ, ajoutez **exclusivement** l'adresse IP du serveur CRM central. C'est une mesure de sécurité critique.
7.  **Sauvegarder** : Appliquez les modifications.

### 2.2. Configuration des Webhooks (CDR - Recommandé)

Pour recevoir les informations d'appel (comme l'URL de l'enregistrement) en temps réel, il est fortement recommandé de configurer le "Push" de CDR.

1.  **Navigation** : Allez dans `Paramètres > API > Paramètres CDR`.
2.  **Activation** : Cochez "Activer le Push de CDR".
3.  **URL du Serveur** : Entrez l'URL du webhook du CRM. Elle doit être de la forme :
    `http://<IP_DU_SERVEUR_CRM>/api/pbx/webhook/<ID_DU_SITE>`
    - `<IP_DU_SERVEUR_CRM>` : L'IP du CRM, accessible depuis le Yeastar.
    - `<ID_DU_SITE>` : L'identifiant unique du site (ex: `site-paris`).
4.  **Format** : Assurez-vous que le format est `JSON`.
5.  **Sauvegarder**.

### 2.3. Cohérence des Extensions

- [ ] Chaque agent dans le CRM doit avoir une extension SIP correspondante sur le Yeastar.
- [ ] L'`Identifiant / Extension` de l'agent dans le CRM (ex: `1001`) doit être **strictement identique** au numéro de son extension sur le Yeastar.
- [ ] Le téléphone de l'agent (physique ou softphone) doit être enregistré et fonctionnel (`Statut: OK` dans le Yeastar).

---

## 3. Ajout du PBX au CRM

Une fois les étapes ci-dessus complétées, utilisez le script fourni pour enregistrer le PBX dans la base de données du CRM.

1.  Connectez-vous en SSH au serveur CRM.
2.  Naviguez vers le dossier de l'application.
3.  Exécutez la commande :
    ```bash
    bash scripts/addPbxSite.sh
    ```
4.  Suivez les instructions interactives en fournissant les informations du site et les identifiants API que vous avez notés.

Après avoir exécuté le script, le service de supervision (`pbxPoller`) du CRM détectera automatiquement le nouveau PBX et commencera à le superviser.
