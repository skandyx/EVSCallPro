# Foire Aux Questions (FAQ) - EVSCallPro

Ce document regroupe les questions fréquentes concernant l'architecture, les fonctionnalités et l'utilisation de l'application EVSCallPro.

---

### Q : Est-il possible pour un agent d'utiliser la carte SIM de son mobile pour appeler au lieu d'un softphone, en cas de mauvaise connexion Internet ?

**R :** Oui, c'est tout à fait possible et c'est une fonctionnalité clé pour garantir la continuité de l'activité. Cela permet de s'affranchir de la qualité de la connexion Internet de l'agent pour la partie la plus critique : la voix.

#### Comment ça fonctionne ? (Mécanisme "Connect to Phone")

Le principe est que le serveur de téléphonie (Asterisk) devient l'intermédiaire qui établit deux appels distincts via le réseau téléphonique classique (PSTN) et les connecte ensemble.

1.  **Initiation depuis le CRM :** L'agent, après avoir sélectionné "Mobile" comme son poste de travail dans l'interface, clique sur le bouton pour appeler un contact.

2.  **Appel vers l'agent (1er appel - "Agent Leg") :** Le système ne lance pas l'appel vers le client. Il ordonne au serveur téléphonique de composer d'abord le **numéro de téléphone mobile de l'agent** (préalablement enregistré dans son profil).

3.  **L'agent décroche :** Le téléphone portable de l'agent sonne. Quand il répond, il est connecté au serveur. Il entend une tonalité ou un message lui indiquant que le système va maintenant appeler le client.

4.  **Appel vers le client (2ème appel - "Customer Leg") :** Dès que le serveur confirme que l'agent a décroché, il lance le deuxième appel vers le numéro du client.

5.  **Mise en relation (Bridge) :** Lorsque le client répond, le serveur connecte (ponte) les deux communications. L'agent et le client peuvent alors se parler.

#### Quels sont les avantages ?

*   **Fiabilité Accrue :** La communication vocale de l'agent passe par le réseau GSM, beaucoup plus stable et résilient aux coupures qu'une connexion Internet résidentielle.
*   **Qualité Audio :** La qualité de la voix est souvent supérieure et n'est pas sujette aux problèmes de "hachures" (jitter) ou de coupures liés à la VoIP.
*   **Contrôle Centralisé Conservé :** Bien que l'audio passe par le téléphone mobile, l'interface CRM reste le centre de contrôle. L'agent continue d'utiliser son écran pour voir le script, qualifier l'appel et terminer la communication.
*   **Supervision et Enregistrement :** Comme l'appel est entièrement géré et ponté par le serveur central, il peut être enregistré, écouté en temps réel par un superviseur et apparaît dans les statistiques comme n'importe quel autre appel.

La seule dépendance à Internet restante est celle, très faible, nécessaire pour l'affichage de l'interface web (script, boutons), qui est bien moins sensible aux instabilités du réseau.
