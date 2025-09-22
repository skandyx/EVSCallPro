# Guide de Configuration : Utiliser un Yeastar S-Series comme Trunk SIP

Ce document explique comment configurer votre PBX Yeastar (S100/S300) pour qu'il agisse comme une simple passerelle (Trunk) vers votre serveur Asterisk central. Dans cette architecture, toute l'intelligence (SVI, files d'attente, routage) est gérée par Asterisk, et le Yeastar ne fait que transmettre les appels entre le réseau public (PSTN) et Asterisk via le VPN.

## Prérequis

- **Serveur Asterisk Central** : L'adresse IP de votre serveur Asterisk doit être connue et joignable depuis le Yeastar via le VPN.
- **Réseau** : Le VPN entre le site et le serveur central doit être stable.
- **Accès Admin** : Vous devez avoir les droits d'administrateur sur l'interface web du Yeastar.

---

## Étape 1 : Créer un Trunk SIP vers Asterisk

Nous allons créer une "connexion" SIP qui enverra tous les appels entrants vers Asterisk.

1.  **Connectez-vous à l'interface de votre Yeastar.**
2.  Naviguez vers `Paramètres > PBX > Trunks`.
3.  Cliquez sur `Ajouter`.
4.  Remplissez les informations suivantes :
    - **Type de Trunk** : `Peer Trunk`.
    - **Type** : `SIP`.
    - **Nom du Trunk** : Donnez un nom explicite, par exemple `Trunk_vers_CRM_Asterisk`.
    - **Nom d'hôte/IP** : Entrez l'**adresse IP de votre serveur Asterisk central**.
    - **Domaine** : Entrez à nouveau l'**adresse IP de votre serveur Asterisk central**.

    ![Création du Peer Trunk](https://support.yeastar.com/hc/article_attachments/360002165094/1-1.png)

5.  **Désactiver la sécurité non nécessaire** :
    - Laissez les champs `Nom d'utilisateur` et `Mot de passe` **vides**. L'authentification se fera par adresse IP.
    - Assurez-vous que l'option `Qualify` est cochée. Cela permet au Yeastar de surveiller l'état de la connexion vers Asterisk.

6.  **Sauvegardez** les modifications.

---

## Étape 2 : Créer une Route Entrante vers Asterisk

Maintenant, nous devons dire au Yeastar que **tous les appels** reçus de votre opérateur public doivent être envoyés via le Trunk que nous venons de créer.

1.  Naviguez vers `Paramètres > PBX > Contrôle d'Appel > Routes Entrantes`.
2.  Cliquez sur `Ajouter`.
3.  Configurez la route comme suit :
    - **Nom de la Route** : `Tout_vers_Asterisk`.
    - **Trunks Membres** : Sélectionnez le ou les trunks de votre (vos) opérateur(s) téléphonique(s) public(s). **NE sélectionnez PAS** le trunk `Trunk_vers_CRM_Asterisk` que vous avez créé.
    - **Modèle de Numérotation** :
        - **Pattern** : `_X.`
        - **Strip** : `0`
        - *Explication* : `_X.` signifie "intercepter n'importe quel numéro appelé". Cela garantit que tous les appels entrants sont capturés par cette règle.
    - **Destination** :
        - Sélectionnez `Trunk SIP`.
        - Dans la liste déroulante, choisissez le trunk que vous avez créé à l'étape 1 (`Trunk_vers_CRM_Asterisk`).

    ![Configuration de la Route Entrante](https://support.yeastar.com/hc/article_attachments/360002165214/2-1.png)

4.  **Sauvegardez** la route. Assurez-vous qu'elle est en haut de la liste pour qu'elle soit traitée en priorité.

---

## Étape 3 : Créer une Route Sortante depuis Asterisk

De la même manière, il faut autoriser les appels venant d'Asterisk à repartir vers le réseau public via votre opérateur.

1.  Naviguez vers `Paramètres > PBX > Contrôle d'Appel > Routes Sortantes`.
2.  Cliquez sur `Ajouter`.
3.  Configurez la route :
    - **Nom de la Route** : `Depuis_Asterisk_vers_PSTN`.
    - **Trunks Membres** : Sélectionnez le `Trunk_vers_CRM_Asterisk` (c'est la source).
    - **Modèle de Numérotation** :
        - **Pattern** : `_X.` (pour autoriser tous les numéros).
    - **Destination** :
        - Sélectionnez le ou les trunks de votre (vos) opérateur(s) téléphonique(s) public(s).

4.  **Sauvegardez**.

---

## Étape 4 : Sécurité et Finalisation

1.  **Désactiver le NAT** : Si la communication se fait entièrement via VPN, il est recommandé de vérifier les paramètres SIP et de désactiver les options NAT sur le trunk `Trunk_vers_CRM_Asterisk` pour éviter des problèmes audio.
    - Allez dans les options avancées du trunk et assurez-vous que `NAT` est sur `Non`.

2.  **Pare-feu du Yeastar** :
    - Naviguez vers `Paramètres > Système > Sécurité > Pare-feu`.
    - Créez une règle qui **accepte** tout le trafic `SIP` et `RTP` provenant de l'**adresse IP de votre serveur Asterisk central**. C'est crucial pour que les appels d'Asterisk ne soient pas bloqués.

3.  **Appliquer les Changements** :
    - En haut de l'interface Yeastar, cliquez sur le bouton orange `Appliquer les changements` pour que toutes vos modifications prennent effet.

Votre Yeastar est maintenant configuré comme une passerelle transparente. Toute la logique d'appel sera gérée par le serveur Asterisk central.