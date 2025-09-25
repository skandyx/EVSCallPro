const jwt = require('jsonwebtoken');

// La clé secrète doit être récupérée des variables d'environnement
// Elle est définie dans votre fichier .env.example.txt comme JWT_SECRET
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;

/**
 * Middleware pour vérifier le token JWT Bearer dans l'en-tête Authorization.
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    // Le format de l'en-tête est "Bearer TOKEN"
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        // Pas de token fourni
        return res.status(401).json({ error: 'Accès non autorisé' });
    }

    jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) {
            console.error('Erreur de vérification JWT:', err.message);
            // Token invalide ou expiré
            return res.status(403).json({ error: 'Session invalide ou expirée' });
        }
        
        // Ajoute les informations de l'utilisateur (id, role) à l'objet de la requête
        req.user = user; 
        
        // Passe au prochain middleware ou à la route
        next(); 
    });
}

module.exports = authMiddleware;
