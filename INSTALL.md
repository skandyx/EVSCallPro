# Guide d'Installation du Backend

Ce document décrit les étapes pour installer et configurer l'environnement serveur nécessaire au fonctionnement de l'Architecte de Solutions de Centre de Contact.

## Prérequis

*   Un serveur ou une machine virtuelle sous Debian/Ubuntu.
*   Des droits `sudo` sur la machine.

## Étape 1 : Installation de PostgreSQL

PostgreSQL servira de base de données pour stocker toutes les configurations.

1.  **Mettre à jour les paquets et installer PostgreSQL :**
    ```bash
    sudo apt update
    sudo apt install postgresql postgresql-contrib
    ```

2.  **Se connecter à PostgreSQL et créer la base de données :**
    ```bash
    sudo -u postgres psql
    ```

3.  **Dans l'invite `psql`, exécutez les commandes suivantes :**
    *   Créez un utilisateur (remplacez `mon_mot_de_passe_securise` par un mot de passe robuste) :
        ```sql
        CREATE USER contact_center_user WITH PASSWORD 'mon_mot_de_passe_securise';
        ```
    *   Créez la base de données :
        ```sql
        CREATE DATABASE contact_center_db OWNER contact_center_user;
        ```
    *   Quittez `psql` :
        ```sql
        \q
        ```

## Étape 2 : Installation d'Asterisk

Asterisk est le moteur de téléphonie qui gérera les appels SIP.

1.  **Installer Asterisk :**
    ```bash
    sudo apt update
    sudo apt install asterisk
    ```

2.  **Démarrer et activer le service Asterisk :**
    ```bash
    sudo systemctl start asterisk
    sudo systemctl enable asterisk
    ```

3.  **Fichiers de configuration clés :**
    *   `/etc/asterisk/sip.conf`: Pour configurer la connexion à votre Trunk SIP (`alloncloud.com`).
    *   `/etc/asterisk/extensions.conf`: Pour définir le plan de numérotation (dialplan) qui transférera le contrôle des appels à notre backend Node.js via AGI.
    *   `/etc/asterisk/manager.conf`: Pour configurer l'accès à l'AMI (Asterisk Manager Interface) si nécessaire.

## Étape 3 : Installation de Node.js

Le backend est une application Node.js. Nous recommandons d'utiliser la version LTS (Long Term Support).

1.  **Installer Node.js (exemple avec NodeSource pour Node.js 20.x) :**
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ```

2.  **Vérifier l'installation :**
    ```bash
    node -v  # Doit afficher une version v20.x.x
    npm -v
    ```

## Étape 4 : Initialisation de la Base de Données

1.  **Assurez-vous d'avoir le fichier `database.sql` à la racine du projet.**

2.  **Exécutez le script pour créer les tables :**
    Remplacez `contact_center_db` par le nom de votre base de données si vous l'avez changé.
    ```bash
    psql -U contact_center_user -d contact_center_db -f database.sql
    ```
    Vous serez invité à entrer le mot de passe de `contact_center_user`.

## Étape 5 : Mise en Place du Backend Node.js

Le code du backend est maintenant disponible dans le dossier `backend/`.

1.  **Naviguez dans le dossier du backend :**
    ```bash
    cd backend
    ```
    
2.  **Installer les dépendances :**
    ```bash
    npm install
    ```

3.  **Créer le fichier de configuration :**
    Copiez le fichier d'exemple `.env.example` vers un nouveau fichier nommé `.env`.
    ```bash
    cp .env.example .env
    ```

4.  **Modifier le fichier `.env` :**
    Ouvrez le fichier `.env` avec un éditeur de texte et assurez-vous que les informations de connexion à la base de données (`DB_USER`, `DB_PASSWORD`, `DB_NAME`) correspondent à celles que vous avez créées à l'Étape 1.
    ```env
    # Fichier .env
    DB_HOST=localhost
    DB_PORT=5432
    DB_USER=contact_center_user
    DB_PASSWORD=mon_mot_de_passe_securise
    DB_NAME=contact_center_db

    AGI_PORT=4573
    ```

## Étape 6 : Lier Asterisk au Backend

La communication entre Asterisk et Node.js se fait via **AGI (Asterisk Gateway Interface)**. Nous devons configurer Asterisk pour qu'il transfère le contrôle des appels entrants à notre serveur backend.

1.  **Modifier le plan de numérotation d'Asterisk :**
    Ouvrez le fichier `/etc/asterisk/extensions.conf` avec des droits `sudo`.
    ```bash
    sudo nano /etc/asterisk/extensions.conf
    ```

2.  **Ajoutez le contexte suivant à la fin du fichier.** Ce contexte interceptera les appels entrants et les enverra à notre script AGI. Assurez-vous d'adapter `[from-sip-provider]` au nom du contexte utilisé par votre Trunk SIP.
    ```ini
    [from-sip-provider]
    exten => _X.,1,Answer()
    exten => _X.,n,Verbose(1, "--- Appel transféré au script AGI Node.js ---")
    ; Pointe vers le serveur AGI du backend sur le port 4573
    exten => _X.,n,AGI(agi://127.0.0.1:4573)
    exten => _X.,n,Hangup()
    ```
    *Note : Si votre backend tourne sur une machine différente d'Asterisk, remplacez `127.0.0.1` par l'adresse IP du serveur backend.*

3.  **Recharger la configuration d'Asterisk :**
    ```bash
    sudo asterisk -rx "dialplan reload"
    ```

## Étape 7 : Lancer le Système et Tester

1.  **Lancez le serveur backend :**
    Dans le répertoire `backend/`, exécutez :
    ```bash
    npm start
    ```
    Vous devriez voir le message `AGI Server listening on port 4573`.

2.  **Peuplez la base de données :**
    Assurez-vous qu'au moins un flux SVI existe dans la table `ivr_flows`. Vous pouvez l'insérer manuellement via `psql` ou utiliser un script si disponible. Le backend est configuré pour récupérer le tout premier flux SVI qu'il trouve pour ce test initial.

3.  **Passez un appel :**
    Appelez l'un de vos numéros configurés sur votre Trunk SIP. Surveillez la console d'Asterisk (`sudo asterisk -rvvv`) et la console où tourne votre backend Node.js. Vous devriez voir les logs de l'exécution du script AGI.
