# Guide d'Installation Complet pour un VPS Debian

Ce document décrit les étapes complètes pour installer, configurer et lancer l'environnement serveur de l'Architecte de Solutions de Centre de Contact sur un serveur de production (VPS) sous Debian ou Ubuntu.

## Prérequis

- Un VPS (Virtual Private Server) avec un accès root ou un utilisateur avec des droits `sudo`.
- Le système d'exploitation Debian 11/12 ou Ubuntu 20.04/22.04.
- Un nom de domaine ou une adresse IP fixe pour votre serveur.
- Les identifiants de votre Trunk SIP fournis par votre opérateur.

---

## Philosophie de la Configuration : Amorçage vs. Gestion

Il est crucial de comprendre la différence entre la configuration initiale (d'amorçage) et la gestion continue.

-   **Configuration d'Amorçage (ce guide)** : Les étapes décrites ici (création du `.env`, configuration de `manager.conf` et `extensions.conf`) sont des opérations d'infrastructure. Elles sont **effectuées une seule fois par l'administrateur système** lors de l'installation. Leur but est de permettre aux différents services (Backend, Base de Données, Téléphonie) de savoir comment communiquer entre eux pour la toute première fois.

-   **Gestion Continue (via l'application)** : Une fois le système amorcé et en ligne, **toute la configuration métier se fait depuis l'interface web**. Par exemple, lorsque vous ajoutez un Trunk SIP dans l'application, c'est le backend qui se chargera de générer dynamiquement le fichier de configuration correspondant pour Asterisk et de le recharger. Vous n'aurez plus à éditer manuellement ces fichiers pour les opérations quotidiennes.

Ce guide couvre donc uniquement la fondation sur laquelle l'application s'appuiera pour fonctionner.

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

## Étape 4 : Installation et Configuration Initiale d'Asterisk

1.  **Installer le paquet Asterisk :**
    *Cette commande installe la version stable d'Asterisk disponible dans les dépôts officiels de Debian/Ubuntu, ainsi que les modules courants.*
    ```bash
    sudo apt install asterisk
    ```

2.  **Démarrer et Activer le service Asterisk :**
    *Une fois l'installation terminée, le service doit être démarré et activé pour se lancer automatiquement au redémarrage du serveur.*
    ```bash
    sudo systemctl start asterisk
    sudo systemctl enable asterisk
    ```

3.  **Vérifier le statut du service :**
    *Cette commande confirme qu'Asterisk est bien en cours d'exécution.*
    ```bash
    sudo systemctl status asterisk
    ```
    Vous devriez voir une ligne `Active: active (running)`. Appuyez sur `q` pour quitter.

4.  **Vérifier la connexion à la console Asterisk (CLI) :**
    *La console CLI est l'outil principal pour interagir avec Asterisk en direct, voir les appels, et débugger.*
    ```bash
    sudo asterisk -rvvv
    ```
    *Le `-r` signifie "connecter à une instance en cours", et `vvv` augmente le niveau de verbosité.*
    *Vous devriez voir une invite comme `votreserveur*CLI>`. Tapez `core show help` pour voir la liste des commandes, puis `exit` pour quitter. Cette étape confirme que le moteur est fonctionnel.*

5.  **(Optionnel mais Recommandé) Configurer les permissions :**
    *Par défaut, les fichiers de configuration dans `/etc/asterisk/` peuvent appartenir à `root`. Pour des raisons de sécurité et pour éviter des problèmes de permissions futurs, il est bon de s'assurer qu'ils appartiennent à l'utilisateur `asterisk`.*
    ```bash
    sudo chown -R asterisk:asterisk /etc/asterisk
    sudo chown -R asterisk:asterisk /var/lib/asterisk
    sudo chown -R asterisk:asterisk /var/log/asterisk
    sudo chown -R asterisk:asterisk /var/spool/asterisk
    sudo chown -R asterisk:asterisk /usr/lib/asterisk
    ```
    *Ensuite, redémarrez Asterisk pour appliquer les changements :*
    ```bash
    sudo systemctl restart asterisk
    ```

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

3.  **Configurer les variables d'environnement (Amorçage) :**
    ```bash
    cp .env.example .env
    sudo nano .env
    ```
    Modifiez ce fichier avec les informations de votre base de données (le mot de passe que vous avez défini à l'étape 3). C'est la configuration de base pour que le backend puisse démarrer.
    ```env
    DB_HOST=localhost
    DB_PORT=5432
    DB_USER=contact_center_user
    DB_PASSWORD=votre_mot_de_passe_securise
    DB_NAME=contact_center_db
    AGI_PORT=4573
    ```

## Étape 7 : Configuration Finale et Liaison des Services (Amorçage)

### 7.1 Configuration d'Asterisk

Modifiez les fichiers de configuration d'Asterisk avec `sudo nano`. **Note :** Il s'agit de la configuration minimale pour qu'Asterisk puisse communiquer avec le backend. La configuration des Trunks SIP eux-mêmes se fera plus tard depuis l'application.

1.  **`/etc/asterisk/manager.conf` - Accès pour l'API (Supervision)**
    Permet au CRM de communiquer avec Asterisk. Les identifiants (`ami_user`, `ami_password`) devront correspondre à ceux saisis dans le module "Connexion Système" du CRM.
    ```ini
    [general]
    enabled = yes
    port = 5038
    bindaddr = 0.0.0.0

    [ami_user]
    secret = ami_password
    deny=0.0.0.0/0.0.0.0
    permit=127.0.0.1/255.255.255.0 ; Autorise uniquement le serveur local à se connecter
    read = all
    write = all
    ```

2.  **`/etc/asterisk/extensions.conf` - Redirection des appels vers le Backend**
    Créez un contexte générique qui enverra tous les appels entrants depuis les Trunks vers le script AGI du backend.
    ```ini
    [from-trunk-context]
    exten => _X.,1,Answer()
    exten => _X.,n,Verbose(1, "--- Appel transféré au script AGI Node.js ---")
    exten => _X.,n,AGI(agi://127.0.0.1:4573)
    exten => _X.,n,Hangup()
    ```
    *Note : Le fichier `sip.conf` sera géré dynamiquement par l'application. Vous n'avez pas besoin de le modifier manuellement pour vos trunks.*

3.  **Appliquer les changements :**
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