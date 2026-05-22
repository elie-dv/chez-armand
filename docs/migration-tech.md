# Migration technique Chez Armand

## Decision

Je recommande Vue 3 + TypeScript + Vite pour la suite du projet.

Raisons principales :
- Le POC actuel est déjà très proche d'un modèle composant : vues admin, formulaires, cartes, modales et états locaux.
- Vue permet une migration progressive depuis HTML/CSS/JS sans imposer beaucoup de cérémonie.
- Le back-office gagnera vite en lisibilité avec des composants par domaine : planning, véhicules, villages, prospection, jeunes, messagerie.
- React serait aussi viable, mais il apporterait plus vite des choix d'architecture supplémentaires pour un produit encore jeune.

## Stack cible

- Vite pour le build et le dev server.
- Vue 3 en Composition API.
- TypeScript strict.
- Supabase JS en dépendance npm, plus via CDN.
- Variables d'environnement `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
- Zod à moyen terme pour valider les formulaires et les payloads serveur.
- Supabase Edge Functions pour toute action sensible : emails, enrichissements, recherches automatiques.

## Plan par étapes

1. Socle frontend
   - Installer Vite + Vue + TypeScript.
   - Migrer la page publique en composants.
   - Sortir la configuration Supabase du code source.
   - Valider le build.

2. Back-office par zones
   - Extraire l'authentification et le client Supabase.
   - Migrer la navigation admin et le layout.
   - Migrer chaque vue une par une : planning, véhicules, villages, jeunes, messagerie, prospection.
   - Remplacer le rendu HTML par chaînes par des composants.

3. Types données
   - Générer les types Supabase depuis le schéma.
   - Typer les tables principales : `villages`, `jeunes`, `vehicules`, `evenements`, `prospection_records`.
   - Ajouter des fonctions d'accès aux données par domaine.

4. Robustesse produit
   - Ajouter lint/format.
   - Ajouter tests unitaires sur validation et mapping données.
   - Ajouter tests smoke Playwright sur les formulaires publics et le login admin.
   - Séparer les environnements local, staging et production.

## État actuel

- `index.html` est migré vers Vue 3 + TypeScript.
- `admin.html` est maintenant une entrée Vite dédiée au nouveau back-office.
- `admin-legacy.html` conserve la version HTML/JS historique comme référence fonctionnelle pendant la migration.
- Le nouveau back-office contient déjà : login Supabase, shell, sidebar, navigation, badges et métriques.
- La vue `villages` est migrée : chargement Supabase, filtres, cartes, détails contact, messages, changement de statut et préparation d'événement depuis une demande acceptée.
- Les vues `jeunes`, `véhicules`, `planning`, `messagerie` et `prospection` sont migrées en composants Vue.
- La prospection Vue couvre le coeur CRM : stats, filtres, ajout manuel, statuts, détails, prévisualisation email, lancement du scan initial `22/35/56`, carte Leaflet et dessin de polygone personnalisé.

## Priorité suivante

Le prochain chantier utile est le durcissement : générer les types Supabase, retirer les `any` restants, ajouter lint/format et ajouter des tests smoke sur les workflows critiques.

## Durcissement réalisé

- Ajout d'un type local `Database` aligné avec `schema.sql`.
- Typage du client Supabase via `createClient<Database>()`.
- Propagation d'un alias `AppSupabaseClient` dans les modules admin.
- Retrait des `any` explicites dans `src`.
- Ajout d'un script `npm run check`, aujourd'hui équivalent au build typé.

Prochaine amélioration possible : remplacer le type local par des types générés automatiquement par Supabase CLI dès que le projet Supabase cible est configuré en local.
