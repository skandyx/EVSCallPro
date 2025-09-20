# Guide d'Installation Complet (Backend) - EVSCallPro

Ce document décrit les étapes nécessaires pour installer et configurer l'ensemble des services backend de l'application sur un serveur **Debian 11/12** ou **Ubuntu 20.04/22.04** vierge.

## Prérequis

- Un serveur VPS ou dédié avec un accès `root` ou `sudo`.
- Les services `curl`, `gnupg` et `sudo` doivent être installés (`apt install curl gnupg sudo`).

---

## Philosophie de la Configuration

Il est crucial de comprendre la différence entre la **configuration d'amorçage** et la **gestion continue**.

-   **Configuration d'Amorçage (ce guide)** : Ce sont les étapes effectuées **une seule fois** par un administrateur système lors de l'installation. Elles permettent aux différents services (Backend, Base de données, Téléphonie) de savoir comment communiquer entre eux. Pensez-y comme donner la clé de contact au moteur. Ces étapes sont manuelles et touchent aux fichiers de configuration système.

-   **Gestion Continue (via l'application)** : Une fois l'installation terminée et les services démarrés, **toute la configuration métier** (création des Trunks, des SVI, des utilisateurs, etc.) se fait **exclusivement via l'interface web de l'application**. Le backend se charge alors de modifier dynamiquement les fichiers de configuration nécessaires (comme ceux d'Asterisk) de manière sécurisée.

---

## Étape 1 : Installation des Dépendances Système

Mettez à jour votre système et installez les paquets de base.
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential git
```

## Étape 2 : Configuration du Pare-feu (UFW)

Nous allons configurer le pare-feu pour n'autoriser que les ports nécessaires. C'est une étape de sécurité essentielle.

```bash
sudo ufw allow ssh     # Garder l'accès SSH
sudo ufw allow 80/tcp    # HTTP (pour le frontend Nginx)
sudo ufw allow 443/tcp   # HTTPS (pour le frontend Nginx)
sudo ufw allow 5038/tcp  # Asterisk AMI (pour la supervision par le backend)
sudo ufw allow 4573/tcp  # AGI Server (pour le contrôle des appels par le backend)
# Le port 3001 pour l'API n'est plus exposé directement. L'accès se fait via Nginx.

# Activer le pare-feu
sudo ufw enable
```
Lors de l'activation, confirmez avec `y`.

## Étape 3 : Installation de la Base de Données (PostgreSQL)

```bash
# Installer PostgreSQL
sudo apt install -y postgresql

# Se connecter à psql pour créer l'utilisateur et la base de données
sudo -u postgres psql

# Dans l'interface psql, exécutez les commandes suivantes :
CREATE USER contact_center_user WITH PASSWORD 'votre_mot_de_passe_securise';
CREATE DATABASE contact_center_db OWNER contact_center_user;
\q
```
**Note** : Remplacez `votre_mot_de_passe_securise` par un mot de passe fort et conservez-le précieusement.

## Étape 4 : Installation du Moteur de Téléphonie (Asterisk)

La version d'Asterisk fournie par les dépôts officiels de Debian/Ubuntu est une version LTS (Long-Term Support), ce qui est idéal pour la stabilité en production.

```bash
# Installer Asterisk
sudo apt install -y asterisk

# Démarrer et activer le service au démarrage du serveur
sudo systemctl start asterisk
sudo systemctl enable asterisk

# Vérifier qu'Asterisk est bien en cours d'exécution
sudo systemctl status asterisk
# Vous devriez voir "active (running)". Appuyez sur Q pour quitter.

# Vérification supplémentaire : se connecter à la console Asterisk
sudo asterisk -rvvv
# Vous devriez voir la console CLI d'Asterisk. Tapez "exit" pour quitter.
```

### 4.1 Sécurisation des Permissions (Optionnel mais recommandé)
Pour des raisons de sécurité, il est bon de s'assurer que les fichiers de configuration d'Asterisk n'appartiennent qu'à l'utilisateur `asterisk`.
```bash
sudo chown -R asterisk:asterisk /etc/asterisk
sudo chown -R asterisk:asterisk /var/lib/asterisk
sudo chown -R asterisk:asterisk /var/log/asterisk
sudo chown -R asterisk:asterisk /var/spool/asterisk
sudo chown -R asterisk:asterisk /usr/lib/asterisk
```

## Étape 5 : Installation de l'Environnement Backend (Node.js)

Nous installons Node.js v20, qui est une version LTS, et PM2, un gestionnaire de processus pour garder notre application en ligne.

```bash
# Installer Node.js v20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installer PM2 globalement
sudo npm install -g pm2
```

## Étape 6 : Déploiement du Code Backend

1.  **Récupérez le code de l'application** (par exemple, avec git) :
    ```bash
    git clone https://votre-repository/EVSCallPro.git
    cd EVSCallPro/backend
    ```

2.  **Installez les dépendances du projet** :
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

1.  **`/etc/asterisk/manager.conf` - Accès pour l'API (Supervision)**
    Modifiez ce fichier pour permettre au CRM de communiquer avec Asterisk.
    ```ini
    [general]
    enabled = yes
    port = 5038
    bindaddr = 127.0.0.1 ; Plus sécurisé, n'écoute que localement

    [ami_user] ; Doit correspondre à ce qui est configuré dans le CRM
    secret = ami_password ; Doit correspondre
    deny=0.0.0.0/0.0.0.0
    permit=127.0.0.1/255.255.255.0 ; Autorise uniquement le serveur local à se connecter
    read = all
    write = all
    ```

2.  **`/etc/asterisk/extensions.conf` - Redirection des appels vers le Backend**
    Ajoutez ce contexte. Il sera utilisé par vos Trunks SIP.
    ```ini
    [from-trunk-context]
    exten => _X.,1,Answer()
    exten => _X.,n,Verbose(1, "--- Appel transféré au script AGI Node.js ---")
    exten => _X.,n,AGI(agi://127.0.0.1:4573)
    exten => _X.,n,Hangup()
    ```

3.  **Appliquer les changements :**
    ```bash
    sudo asterisk -rx "core reload"
    ```
    **Note** : La configuration des Trunks SIP (`sip.conf` ou `pjsip.conf`) se fera désormais **via l'interface du CRM**.

## Étape 8 : Démarrage du Backend avec PM2

Nous allons lancer le serveur backend en tant que service pour qu'il tourne en permanence.

1.  **Depuis le dossier `EVSCallPro/backend`** :
    ```bash
    pm2 start server.js --name evscallpro-backend
    ```

2.  **Sauvegarder la configuration de PM2** pour qu'il redémarre l'application après un reboot du serveur :
    ```bash
    pm2 save
    pm2 startup
    # Suivez les instructions affichées par la dernière commande pour la finaliser.
    ```

3.  **Vérifier que l'application est en ligne** :
    ```bash
    pm2 status
    # Vous devriez voir 'evscallpro-backend' avec le statut 'online'.
    ```

---

## Étape 9 : Création du Schéma de la Base de Données

Maintenant que tout est en place, nous devons créer les tables dans notre base de données.

1.  **Connectez-vous à votre base de données** :
    ```bash
    psql -U contact_center_user -d contact_center_db -h localhost
    ```
    Entrez le mot de passe que vous avez défini.

2.  **Copiez et collez l'intégralité du contenu du fichier `database.txt`** dans le terminal `psql` et appuyez sur Entrée. Cela créera toutes les tables, relations et triggers nécessaires.

3.  **Quittez psql** :
    ```bash
    \q
    ```

---

## Dépannage (Logs)

-   **Pour voir les logs du backend** : `pm2 logs evscallpro-backend`
-   **Pour voir les logs d'Asterisk** : `sudo asterisk -rvvv` (console en direct) ou consultez `/var/log/asterisk/messages`.
-   **Pour voir les logs de PostgreSQL** : Consultez le répertoire `/var/log/postgresql/`.

Votre infrastructure backend est maintenant entièrement installée et fonctionnelle ! L'étape suivante consiste à déployer le frontend en suivant le guide `DEPLOY_FRONTEND.md`.