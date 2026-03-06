# Chez Armand - Site Web

Site web de l'association Chez Armand, créant du lien social dans les villages de moins de 100 habitants en proposant planches de charcuterie, bières et vins l'été.

## 🚀 Configuration

### 1. Configuration Supabase

1. Connectez-vous à votre projet Supabase : https://supabase.com
2. Allez dans l'éditeur SQL (SQL Editor)
3. Exécutez le script `schema.sql` pour créer les tables `villages` et `jeunes`
4. Récupérez votre URL de projet et votre clé anonyme (anon key) :
   - Allez dans Settings > API
   - Copiez l'URL du projet (Project URL)
   - Copiez la clé anonyme (anon/public key)

### 2. Configuration du site

1. Ouvrez le fichier `script.js`
2. Remplacez `YOUR_SUPABASE_ANON_KEY` par votre clé anonyme Supabase réelle
3. Vérifiez que `SUPABASE_URL` correspond à votre URL de projet

```javascript
const SUPABASE_URL = 'https://votre-projet.supabase.co';
const SUPABASE_ANON_KEY = 'votre_cle_anonyme_ici';
```

## 📁 Structure des fichiers

```
chez-armand/
├── index.html          # Page principale
├── styles.css          # Styles CSS
├── script.js           # Logique JavaScript et intégration Supabase
├── schema.sql          # Script SQL pour créer les tables
└── README.md           # Ce fichier
```

## 🗄️ Base de données

### Table `villages`
- `id` (UUID) - Identifiant unique
- `nom` (TEXT) - Nom du village
- `code_postal` (TEXT) - Code postal
- `nombre_habitants` (INTEGER) - Nombre d'habitants
- `contact_nom` (TEXT) - Nom du contact
- `contact_email` (TEXT) - Email du contact
- `contact_telephone` (TEXT) - Téléphone du contact
- `date_souhaitee` (DATE) - Date souhaitée (optionnel)
- `message` (TEXT) - Message supplémentaire (optionnel)
- `created_at` (TIMESTAMP) - Date de création

### Table `jeunes`
- `id` (UUID) - Identifiant unique
- `prenom` (TEXT) - Prénom
- `nom` (TEXT) - Nom
- `age` (INTEGER) - Âge
- `email` (TEXT) - Email
- `telephone` (TEXT) - Téléphone
- `motivation` (TEXT) - Motivation
- `created_at` (TIMESTAMP) - Date de création

## 🌐 Déploiement sur Hostinger

### Méthode 1 : Via le gestionnaire de fichiers Hostinger

1. Connectez-vous à votre compte Hostinger
2. Allez dans le gestionnaire de fichiers (File Manager)
3. Naviguez vers le dossier `public_html` (ou le dossier de votre domaine `chez-armand.fr`)
4. Téléversez tous les fichiers :
   - `index.html`
   - `styles.css`
   - `script.js`
5. Assurez-vous que `index.html` est à la racine du dossier

### Méthode 2 : Via FTP

1. Utilisez un client FTP (FileZilla, Cyberduck, etc.)
2. Connectez-vous avec vos identifiants FTP Hostinger
3. Téléversez les fichiers dans le dossier `public_html` (ou le dossier de votre domaine)

### Méthode 3 : Via Git (si disponible)

1. Initialisez un dépôt Git dans votre projet local
2. Créez un dépôt sur GitHub/GitLab
3. Configurez le déploiement automatique sur Hostinger (si disponible)

## ✅ Vérification

Après le déploiement :

1. Visitez `https://chez-armand.fr` (ou votre URL)
2. Testez le formulaire "Vous êtes un village"
3. Testez le formulaire "Vous êtes un jeune"
4. Vérifiez dans Supabase que les données sont bien enregistrées

## 🔒 Sécurité

- Les tables utilisent Row Level Security (RLS) avec des politiques permettant uniquement les insertions publiques
- Les données sensibles ne sont pas exposées côté client
- La validation est effectuée à la fois côté client et côté serveur (via Supabase)

## 📝 Notes

- Le site est entièrement en français
- Le design est responsive et fonctionne sur mobile et desktop
- Les formulaires incluent une validation complète avant soumission
- Les messages de succès/erreur sont affichés à l'utilisateur

## 🛠️ Support

Pour toute question ou problème :
1. Vérifiez que Supabase est correctement configuré
2. Vérifiez la console du navigateur pour les erreurs JavaScript
3. Vérifiez les logs Supabase pour les erreurs de base de données

## 📄 Licence

© 2024 Chez Armand. Tous droits réservés.
