# Guide de Déploiement du Frontend sur un VPS

Ce document explique comment déployer l'interface utilisateur (le frontend React) de l'application sur un serveur de production pour la rendre accessible via un navigateur web. Il complète le guide `INSTALL.md` qui se concentre sur le backend.

Nous utiliserons **Nginx** comme serveur web, ce qui est la solution standard, performante et sécurisée.

## Prérequis

- Vous avez suivi le guide `INSTALL.md` et tous les services backend sont fonctionnels sur votre VPS.
- Vous avez le code source du frontend sur votre machine locale ou sur le serveur.
- `npm` est installé.

---

## Le Processus en 2 Étapes Clés

1.  **"Compiler" l'application React** : Le code source de votre interface (les fichiers `.tsx`) doit être transformé en un ensemble de fichiers statiques (HTML, CSS, JavaScript) que n'importe quel navigateur peut comprendre. C'est ce qu'on appelle le "build".
2.  **Configurer Nginx pour servir ces fichiers** : Nous allons installer Nginx et lui dire de montrer ces fichiers statiques à quiconque visite l'adresse IP de votre serveur.

---

## Étape 1 : Préparer ("Builder") les Fichiers du Frontend

Cette étape transforme votre code de développement en fichiers optimisés pour la production.

1.  **Placez-vous dans le dossier racine du projet frontend.**
    *Ce dossier est celui qui contient `package.json`, `index.html`, `App.tsx`, etc.*

2.  **Installez les dépendances du projet** (si ce n'est pas déjà fait) :
    ```bash
    npm install
    ```

3.  **Lancez la commande de build** :
    ```bash
    # Cette commande peut varier, mais `build` est la convention standard.
    # Référez-vous au script "build" dans votre fichier `package.json`.
    npm run build
    ```
    Cette commande va créer un nouveau dossier (généralement nommé `dist/`). Ce dossier contient tout ce dont nous avons besoin pour l'interface web.

---

## Étape 2 : Mettre en Place Nginx sur le VPS

1.  **Créez un répertoire pour héberger vos fichiers web** :
    ```bash
    sudo mkdir -p /var/www/evscallpro
    ```

2.  **Transférez le contenu du dossier `dist/`** (créé à l'étape 1) dans le répertoire `/var/www/evscallpro` de votre VPS. Vous pouvez utiliser des outils comme `scp` ou `rsync`.
    *Exemple avec `scp` depuis votre machine locale :*
    ```bash
    scp -r ./dist/* votre_user@votre_ip_vps:/var/www/evscallpro/
    ```

3.  **Installez Nginx** :
    ```bash
    sudo apt update
    sudo apt install nginx
    ```

4.  **Configurez le Pare-feu** pour autoriser le trafic web :
    ```bash
    sudo ufw allow 'Nginx HTTP'
    sudo ufw reload
    ```

5.  **Créez un fichier de configuration Nginx pour votre site** :
    ```bash
    sudo nano /etc/nginx/sites-available/evscallpro
    ```

6.  **Collez la configuration suivante dans ce fichier**.
    *Remplacez `votre_adresse_ip_vps` par l'IP de votre serveur (ou votre nom de domaine si vous en avez un).*

    ```nginx
    server {
        listen 80;
        server_name votre_adresse_ip_vps;

        # Chemin vers les fichiers que vous avez transférés
        root /var/www/evscallpro;
        index index.html;

        location / {
            # Cette ligne est CRUCIALE pour les applications React.
            # Elle assure que toutes les URL sont gérées par React Router
            # et évite les erreurs 404 lors du rafraîchissement de la page.
            try_files $uri /index.html;
        }

        # Fichiers de log pour le débogage
        access_log /var/log/nginx/evscallpro.access.log;
        error_log /var/log/nginx/evscallpro.error.log;
    }
    ```

7.  **Activez la configuration** en créant un lien symbolique :
    ```bash
    sudo ln -s /etc/nginx/sites-available/evscallpro /etc/nginx/sites-enabled/
    ```

8.  **Vérifiez que la syntaxe de votre configuration est correcte** :
    ```bash
    sudo nginx -t
    ```
    Si tout va bien, le terminal affichera `syntax is ok` et `test is successful`.

9.  **Redémarrez Nginx** pour appliquer tous les changements :
    ```bash
    sudo systemctl restart nginx
    ```

---

## Étape 3 : Accéder à l'Interface

Ouvrez votre navigateur web et rendez-vous à l'adresse de votre serveur :

`http://votre_adresse_ip_vps`

Vous devriez maintenant voir l'écran de connexion de votre application "EVSCallPro".

### Dépannage
- **Page blanche ou erreur 404** : Vérifiez le chemin (`root`) dans votre fichier de configuration Nginx. Assurez-vous qu'il pointe bien vers le dossier contenant `index.html`. Consultez les logs d'erreur de Nginx avec `sudo tail -f /var/log/nginx/evscallpro.error.log`.
- **Le site ne charge pas du tout** : Vérifiez que Nginx est bien en cours d'exécution (`sudo systemctl status nginx`) et que votre pare-feu autorise le port 80 (`sudo ufw status`).
