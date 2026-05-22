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

1. Copiez `.env.example` vers `.env`
2. Renseignez les variables Vite :

```bash
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre_cle_anonyme_ici
```

### 3. Développement et build

```bash
npm install
npm run dev
npm run build
```

Après `npm run build`, servir le dossier `dist` :

```bash
python3 -m http.server 8000 -d dist
```

## 📁 Structure des fichiers

```
chez-armand/
├── index.html          # Entrée Vite du site public
├── admin.html          # Entrée Vite du back-office
├── admin-legacy.html   # Ancienne version statique gardée comme référence
├── src/                # Application Vue 3 + TypeScript
├── styles.css          # Styles du site public
├── admin.css           # Styles du back-office
├── schema.sql          # Script SQL pour créer toutes les tables
└── README.md           # Ce fichier
```

## 🔐 Back-office (Admin)

### Configuration

1. **Créer un utilisateur admin** dans Supabase :
   - Allez dans Authentication > Users
   - Cliquez sur "Add user" > "Create new user"
   - Entrez un email et un mot de passe pour l'admin
2. **Exécuter le schema.sql** mis à jour pour créer les nouvelles tables et politiques RLS
3. Accédez au back-office via `https://chez-armand.fr/admin.html`

### Fonctionnalités

- **Planning hebdomadaire** : vue par véhicule avec navigation semaine par semaine
- **Gestion des véhicules** : créer/modifier des véhicules, assigner des équipes de jeunes
- **Gestion des événements** : créer/modifier des événements (van, lieu, dates, nb personnes)
- **Demandes de villages** : consulter, accepter/refuser les demandes, créer un événement depuis une demande
- **Prospection communes** : suivre les communes candidates, filtrer, prévisualiser les emails, tracer les statuts et lancer le scan initial
- **Candidatures jeunes** : consulter, accepter/refuser les candidatures
- **Messagerie** : conversations avec les jeunes acceptés

### Prospection communes

Le module de prospection est conçu comme un mini-CRM communal.

Critères V1 :
- Départements ciblés : `22`, `35`, `56`
- Population : moins de 500 habitants
- Commerces : moins de 3 commerces estimés via OpenStreetMap

Workflow carte :
- Cliquer sur **Dessiner une zone** dans la carte de prospection
- Ajouter les points du polygone en cliquant sur la carte
- Déplacer les points existants pour ajuster la zone
- Cliquer sur un petit point intermédiaire pour insérer un nouveau point sur un segment
- Sélectionner un point puis **Supprimer point** pour l’enlever
- Cliquer sur **Sauvegarder et lancer** pour créer une entrée `prospection_areas` de type `polygon` et appeler `scan-prospection-area`

Sources prévues :
- Population : INSEE, populations de référence par commune
- Contacts mairie : API Annuaire de l’administration Service-public.fr et `etablissements-publics.api.gouv.fr`, sélectionnables dans l’admin
- Commerces : OpenStreetMap via Overpass API, avec miroir `overpass.kumi.systems` en priorité
- Zones dessinées : croisement Geo API + Overpass pour éviter de ne retenir que les communes dont le centre tombe dans le polygone
- Fallback communes : package Etalab `@etalab/decoupage-administratif` si `geo.api.gouv.fr` est indisponible

Le back-office est statique : les identifiants Gmail SMTP ne doivent jamais être exposés côté navigateur. L’envoi réel et les recherches automatiques doivent donc passer par des fonctions serveur authentifiées.

Fonctions serveur attendues :
- `scan-prospection-area`
  - Première entrée : `{ "area_id": "uuid", "batch_size": 8 }`
  - Entrées suivantes : `{ "job_id": "uuid", "batch_size": 8 }`
  - Rôle : créer un job de scan, traiter les communes par lots, filtrer population/commerces, enrichir les contacts mairie, créer/mettre à jour `municipalities`, `municipality_enrichments` et `prospection_records`
  - Implémentation fournie : `supabase/functions/scan-prospection-area/index.ts`
  - Note : le scan limite par défaut à 300 communes candidates par lancement (`max_candidates`) et l’admin boucle par lots pour éviter les timeouts Overpass
- `send-prospection-email`
  - Entrée : `{ "email_id": "uuid" }`
  - Rôle : lire le brouillon dans `prospection_emails`, envoyer via Gmail API côté serveur, puis renvoyer `{ "message_id": "..." }`
  - Implémentation fournie : `supabase/functions/send-prospection-email/index.ts`
- `research-municipality`
  - Entrée : `{ "municipality_id": "uuid", "research_id": "uuid" }`
  - Rôle : enrichir une commune avec comité des fêtes, associations, événements existants et sources dans `municipality_researches`

Statuts de prospection :
`to_review`, `ready_to_contact`, `email_previewed`, `email_sent`, `to_call`, `called`, `follow_up_needed`, `replied`, `interested`, `not_interested`, `do_not_contact`.

Déploiement de la fonction de scan :

```bash
supabase functions deploy scan-prospection-area
supabase functions deploy send-prospection-email
```

Variables attendues côté Supabase Edge Functions :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_FROM_EMAIL`
- `GMAIL_FROM_NAME`

Configuration Gmail :
1. Créer un projet Google Cloud
2. Activer **Gmail API**
3. Créer un client OAuth
4. Obtenir un refresh token avec le scope `https://www.googleapis.com/auth/gmail.send`
5. Ajouter les secrets Supabase :

```bash
supabase secrets set GMAIL_CLIENT_ID="..."
supabase secrets set GMAIL_CLIENT_SECRET="..."
supabase secrets set GMAIL_REFRESH_TOKEN="..."
supabase secrets set GMAIL_FROM_EMAIL="devismes.elie@gmail.com"
supabase secrets set GMAIL_FROM_NAME="Chez Armand"
```

Test local Deno de la logique réseau, sans lancer Supabase :

```bash
deno check supabase/functions/scan-prospection-area/index.ts
deno run --allow-net supabase/functions/scan-prospection-area/smoke_test.ts
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
- `statut` (TEXT) - nouveau / contacte / accepte / refuse
- `created_at` (TIMESTAMP) - Date de création

### Table `jeunes`
- `id` (UUID) - Identifiant unique
- `prenom` (TEXT) - Prénom
- `nom` (TEXT) - Nom
- `age` (INTEGER) - Âge
- `email` (TEXT) - Email
- `telephone` (TEXT) - Téléphone
- `motivation` (TEXT) - Motivation
- `statut` (TEXT) - nouveau / accepte / refuse
- `created_at` (TIMESTAMP) - Date de création

### Table `vehicules`
- `id` (UUID) - Identifiant unique
- `nom` (TEXT) - Nom du véhicule
- `type` (TEXT) - Type (van, camion, camionnette, autre)
- `description` (TEXT) - Description (optionnel)
- `couleur` (TEXT) - Code couleur hex
- `actif` (BOOLEAN) - Véhicule actif ou non
- `created_at` (TIMESTAMP) - Date de création

### Table `equipe_membres`
- `id` (UUID) - Identifiant unique
- `vehicule_id` (UUID) - Référence au véhicule
- `jeune_id` (UUID) - Référence au jeune
- `created_at` (TIMESTAMP) - Date de création

### Table `evenements`
- `id` (UUID) - Identifiant unique
- `vehicule_id` (UUID) - Véhicule attribué
- `village_id` (UUID) - Village associé (optionnel)
- `titre` (TEXT) - Titre de l'événement
- `lieu` (TEXT) - Lieu
- `date_debut` (DATE) - Date de début
- `date_fin` (DATE) - Date de fin
- `nb_personnes_prevu` (INTEGER) - Nombre de personnes prévu
- `statut` (TEXT) - planifie / confirme / en_cours / termine / annule
- `notes` (TEXT) - Notes (optionnel)
- `created_at` / `updated_at` (TIMESTAMP)

### Tables de prospection
- `prospection_areas` - Zones de scan extensibles : départements, polygone, rayon ou sélection manuelle
- `municipalities` - Référentiel des communes avec code INSEE, population et coordonnées
- `municipality_enrichments` - Contacts mairie, horaires, nombre de commerces estimé et sources
- `prospection_records` - Statut commercial, notes, dernière prise de contact et prochaine action
- `prospection_scan_jobs` - Jobs de scan automatique avec communes candidates, progression, compteurs et erreurs
- `prospection_emails` - Brouillons, envois, erreurs SMTP et historique email
- `municipality_researches` - Recherches contextuelles sur événements, associations et comité des fêtes

## 🌐 Déploiement sur Vercel

Le front est livré par Vercel. Supabase reste utilisé pour la base, l'authentification et les Edge Functions.

### Configuration Vercel

1. Framework preset : `Vite`
2. Build command : `npm run build`
3. Output directory : `dist`
4. Variables d'environnement à ajouter dans Vercel :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Redéployer le projet après chaque changement de variable d'environnement.

URLs principales :

- Site public : `https://chez-armand.fr`
- Admin : `https://chez-armand.fr/admin.html`

Si le domaine custom n'est pas encore branché, utilisez l'URL Vercel du projet avec le même chemin `/admin.html`.

### Configuration Supabase Auth

Dans Supabase, configurez les URLs d'authentification pour que les liens de connexion et de récupération de mot de passe reviennent vers l'admin.

- Site URL : `https://chez-armand.fr`
- Redirect URLs :
  - `https://chez-armand.fr/admin.html`
  - `https://<votre-projet-vercel>.vercel.app/admin.html`
  - `http://127.0.0.1:5173/admin.html`

### Fonctions Supabase

Les fonctions serveur ne sont pas déployées par Vercel. Elles doivent être publiées côté Supabase :

```bash
supabase functions deploy scan-prospection-area
supabase functions deploy send-prospection-email
```

Pour l'envoi Gmail, ajoutez aussi les secrets Supabase :

```bash
supabase secrets set GMAIL_CLIENT_ID="..."
supabase secrets set GMAIL_CLIENT_SECRET="..."
supabase secrets set GMAIL_REFRESH_TOKEN="..."
supabase secrets set GMAIL_FROM_EMAIL="..."
supabase secrets set GMAIL_FROM_NAME="Chez Armand"
```

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

© 2026 Chez Armand. Tous droits réservés.
