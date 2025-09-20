# Guide d'Installation Complet pour un VPS Debian

Ce document décrit les étapes complètes pour installer, configurer et lancer l'environnement serveur de l'Architecte de Solutions de Centre de Contact sur un serveur de production (VPS) sous Debian ou Ubuntu.

## Prérequis

- Un VPS (Virtual Private Server) avec un accès root ou un utilisateur avec des droits `sudo`.
- Le système d'exploitation Debian 11/12 ou Ubuntu 20.04/22.04.
- Un nom de domaine ou une adresse IP fixe pour votre serveur.
- Les identifiants de votre Trunk SIP fournis par votre opérateur.

---

## Vue d'ensemble de l'Installation

1.  **Préparation du Système** : Mise à jour du serveur.
2.  **Configuration du Pare-feu** : Sécurisation des ports.
3.  **Installation de PostgreSQL** : La base de données.
4.  **Installation d'Asterisk** : Le moteur de téléphonie.
5.  **Installation de Node.js & PM2** : L'environnement d'exécution du backend.
6.  **Déploiement du Backend** : Récupération du code et installation des dépendances.
7.  **Configuration Finale** : Liaison de tous les services.
8.  **Lancement de l'Application** : Démarrage du backend en tant que service persistant.
9.  **Vérification & Dépannage** : Commandes pour s'assurer que tout fonctionne.

---

## Étape 1 : Préparation du Système

Mettez à jour la liste des paquets et les paquets installés sur votre serveur.

```bash
sudo apt update && sudo apt upgrade -y
```

## Étape 2 : Configuration du Pare-feu (UFW)

Nous allons utiliser `UFW` (Uncomplicated Firewall) pour sécuriser le serveur.

1.  **Installer UFW (s'il n'est pas déjà présent) :**
    ```bash
    sudo apt install ufw
    ```

2.  **Autoriser les ports nécessaires :**
    ```bash
    # Autoriser SSH (Très important pour ne pas perdre l'accès !)
    sudo ufw allow OpenSSH

    # Autoriser les ports pour Asterisk (SIP & RTP)
    sudo ufw allow 5060/udp     # Port SIP standard
    sudo ufw allow 10000:20000/udp # Plage de ports RTP pour l'audio

    # Autoriser l'accès local pour l'AGI (le backend communique avec Asterisk)
    # Remplacer 127.0.0.1 par l'IP du serveur si le backend est sur une autre machine
    sudo ufw allow from 127.0.0.1 to any port 4573 proto tcp

    # (Optionnel) Autoriser le port HTTP/HTTPS si le frontend est sur le même serveur
    # sudo ufw allow http
    # sudo ufw allow https
    ```

3.  **Activer le pare-feu :**
    ```bash
    sudo ufw enable
    ```
    Confirmez avec `y` lorsque demandé. Vérifiez le statut avec `sudo ufw status`.

## Étape 3 : Installation de la Base de Données (PostgreSQL)

1.  **Installer PostgreSQL :**
    ```bash
    sudo apt install postgresql postgresql-contrib
    ```

2.  **Se connecter et créer l'utilisateur et la base de données :**
    ```bash
    sudo -u postgres psql
    ```

3.  **Dans l'invite `psql`, exécutez les commandes suivantes :**
    *Remplacez `votre_mot_de_passe_securise` par un mot de passe robuste.*
    ```sql
    CREATE USER contact_center_user WITH PASSWORD 'votre_mot_de_passe_securise';
    CREATE DATABASE contact_center_db OWNER contact_center_user;
    \q
    ```

4.  **Vérifier la création :**
    ```bash
    sudo -u postgres psql -c "\l"
    ```
    Vous devriez voir `contact_center_db` dans la liste.

## Étape 4 : Installation du Moteur de Téléphonie (Asterisk)

1.  **Installer Asterisk :**
    ```bash
    sudo apt install asterisk
    ```

2.  **Vérifier qu'Asterisk est bien en cours d'exécution :**
    ```bash
    sudo systemctl status asterisk
    ```
    Vous devriez voir `active (running)`. Appuyez sur `q` pour quitter.

## Étape 5 : Installation de l'Environnement Backend (Node.js & PM2)

1.  **Installer Node.js v20.x (LTS recommandée) :**
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ```

2.  **Installer PM2**, un gestionnaire de processus pour Node.js qui maintiendra notre application en ligne :
    ```bash
    sudo npm install pm2 -g
    ```

## Étape 6 : Déploiement du Backend de l'Application

1.  **Récupérez le code de l'application.** La méthode la plus courante est d'utiliser `git`.
    ```bash
    # Installer git si nécessaire
    sudo apt install git

    # Clonez votre projet (remplacez l'URL par celle de votre dépôt)
    git clone https://votre-depot-git.com/evscallpro.git
    cd evscallpro/backend
    ```

2.  **Installer les dépendances du projet :**
    ```bash
    npm install
    ```

3.  **Configurer les variables d'environnement :**
    ```bash
    cp .env.example .env
    sudo nano .env
    ```
    Modifiez le fichier `.env` avec les informations de votre base de données (le mot de passe que vous avez défini à l'étape 3).
    ```env
    DB_HOST=localhost
    DB_PORT=5432
    DB_USER=contact_center_user
    DB_PASSWORD=votre_mot_de_passe_securise
    DB_NAME=contact_center_db
    AGI_PORT=4573
    ```

## Étape 7 : Configuration Finale et Liaison des Services

### 7.1 Configuration d'Asterisk

Modifiez les fichiers de configuration d'Asterisk avec `sudo nano`.

1.  **`/etc/asterisk/sip.conf` - Connexion à votre Trunk SIP**
    Ajoutez ceci à la fin du fichier, en remplaçant les valeurs par celles de votre fournisseur :
    ```ini
    [general]
    register => VOTRE_LOGIN:VOTRE_MOT_DE_PASSE@VOTRE_FOURNISSEUR_SIP/VOTRE_LOGIN

    [from-trunk](!)
    type=friend
    context=from-trunk-context ; Contexte pour les appels entrants
    host=VOTRE_FOURNISSEUR_SIP
    insecure=port,invite
    qualify=yes

    [VOTRE_FOURNISSEUR_SIP](from-trunk)
    defaultuser=VOTRE_LOGIN
    secret=VOTRE_MOT_DE_PASSE
    fromuser=VOTRE_LOGIN
    fromdomain=VOTRE_FOURNISSEUR_SIP
    ```

2.  **`/etc/asterisk/manager.conf` - Accès pour l'API (Supervision)**
    Modifiez ce fichier pour permettre au CRM de communiquer avec Asterisk.
    ```ini
    [general]
    enabled = yes
    port = 5038
    bindaddr = 0.0.0.0

    [ami_user] ; Doit correspondre à ce qui est configuré dans le CRM
    secret = ami_password ; Doit correspondre
    deny=0.0.0.0/0.0.0.0
    permit=127.0.0.1/255.255.255.0 ; Autorise uniquement le serveur local à se connecter
    read = all
    write = all
    ```

3.  **`/etc/asterisk/extensions.conf` - Redirection des appels vers le Backend**
    Ajoutez ce contexte. Il doit correspondre au `context` défini dans `sip.conf`.
    ```ini
    [from-trunk-context]
    exten => _X.,1,Answer()
    exten => _X.,n,Verbose(1, "--- Appel transféré au script AGI Node.js ---")
    exten => _X.,n,AGI(agi://127.0.0.1:4573)
    exten => _X.,n,Hangup()
    ```

4.  **Appliquer les changements :**
    ```bash
    sudo asterisk -rx "core reload"
    ```

### 7.2 Initialisation du Schéma de la Base de Données

En supposant qu'un fichier `database.sql` existe à la racine du projet pour créer les tables nécessaires.

```bash
# Assurez-vous d'être dans le dossier racine du projet 'evscallpro'
# psql -U contact_center_user -d contact_center_db -f ./database.sql
# Remarque : Le fichier database.txt fourni est vide. Cette étape suppose un fichier de schéma SQL.
```

## Étape 8 : Lancement de l'Application en tant que Service

1.  **Démarrez le backend avec PM2 :**
    *Depuis le dossier `backend/`*
    ```bash
    pm2 start server.js --name evscallpro-backend
    ```

2.  **Configurez PM2 pour démarrer automatiquement au redémarrage du serveur :**
    ```bash
    pm2 startup
    ```
    Copiez-collez et exécutez la commande que PM2 vous donne.

3.  **Sauvegardez la configuration de PM2 :**
    ```bash
    pm2 save
    ```

## Étape 9 : Vérification et Dépannage

1.  **Vérifier le statut de tous les services :**
    ```bash
    sudo systemctl status postgresql
    sudo systemctl status asterisk
    pm2 status
    ```
    Tous devraient être `active` ou `online`.

2.  **Consulter les journaux (logs) en cas de problème :**
    ```bash
    # Logs du backend
    pm2 logs evscallpro-backend

    # Logs d'Asterisk
    sudo journalctl -u asterisk -f

    # Console live d'Asterisk (très utile pour voir les appels en direct)
    sudo asterisk -rvvv
    ```

Votre application est maintenant installée, configurée et fonctionne de manière persistante sur votre VPS. Vous pouvez maintenant configurer vos Trunks, Numéros et SVI depuis l'interface web.
