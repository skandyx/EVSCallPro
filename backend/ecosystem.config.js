// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'evscallpro-backend',
      // Demande à PM2 de lancer la commande 'npm' avec l'argument 'start'
      script: 'npm',
      args: 'start',
      // Le 'cwd' (Current Working Directory) reste crucial.
      // Il force PM2 à exécuter la commande depuis le bon dossier.
      cwd: '/home/debian/EVSCallPro/backend/',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
