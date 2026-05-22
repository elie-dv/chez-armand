<script setup lang="ts">
import type { AdminMetric, AdminViewId } from '../types';

const props = defineProps<{
  id: AdminViewId;
  metrics: AdminMetric[];
  isLoading: boolean;
}>();

const viewMeta: Record<AdminViewId, { title: string; action: string; body: string; next: string }> = {
  planning: {
    title: 'Planning',
    action: '+ Événement',
    body: 'La prochaine étape consistera à migrer la grille hebdomadaire, la navigation de semaine et le formulaire événement.',
    next: 'Priorité recommandée : extraire les fonctions dates/planning en TypeScript, puis créer un composant PlanningGrid.',
  },
  vehicules: {
    title: 'Véhicules',
    action: '+ Véhicule',
    body: 'Cette vue reprendra la gestion des véhicules et l’affectation des jeunes aux équipes.',
    next: 'À migrer après le planning, car les événements dépendent des véhicules actifs.',
  },
  villages: {
    title: 'Demandes de villages',
    action: 'Actualiser',
    body: 'Cette vue portera les filtres de statut, les cartes demandes et la création rapide d’événement depuis une demande.',
    next: 'Bon candidat pour une migration rapide après le shell, avec un store Supabase dédié.',
  },
  prospection: {
    title: 'Prospection communes',
    action: 'Lancer la recherche',
    body: 'La prospection combine liste, carte, filtres et Edge Function. Elle mérite un module séparé pour éviter de recréer le monolithe.',
    next: 'À isoler avec des composants ProspectionMap, ProspectionList et ProspectionScanControls.',
  },
  jeunes: {
    title: 'Candidatures jeunes',
    action: 'Actualiser',
    body: 'Cette vue migrera les filtres, les statuts de candidature et les actions accepter/refuser.',
    next: 'Simple à migrer en parallèle des villages, car le modèle UI est proche.',
  },
  messagerie: {
    title: 'Messagerie',
    action: 'Nouveau message',
    body: 'La messagerie restera désactivée jusqu’à migration des conversations et de l’envoi côté Supabase.',
    next: 'À traiter après jeunes, puisque les contacts viennent des candidatures acceptées.',
  },
};
</script>

<template>
  <div class="view">
    <div class="view-header">
      <div>
        <h1>{{ viewMeta[props.id].title }}</h1>
        <p class="view-subtitle">Migration Vue/TypeScript en cours.</p>
      </div>
      <div class="view-actions">
        <button class="btn btn-primary" disabled>{{ viewMeta[props.id].action }}</button>
      </div>
    </div>

    <div v-if="props.id === 'planning'" class="admin-migration-metrics">
      <div v-for="metric in metrics" :key="metric.label" class="admin-migration-metric">
        <span class="admin-migration-metric-value">{{ isLoading ? '...' : metric.value }}</span>
        <span class="admin-migration-metric-label">{{ metric.label }}</span>
        <span class="admin-migration-metric-helper">{{ metric.helper }}</span>
      </div>
    </div>

    <div class="admin-migration-panel">
      <span class="empty-icon">🛠️</span>
      <h3>{{ viewMeta[props.id].title }} arrive dans le nouveau back-office</h3>
      <p>{{ viewMeta[props.id].body }}</p>
      <p class="admin-migration-next">{{ viewMeta[props.id].next }}</p>
      <p class="admin-migration-legacy">
        Référence conservée dans <code>admin-legacy.html</code> pendant la migration.
      </p>
    </div>
  </div>
</template>
