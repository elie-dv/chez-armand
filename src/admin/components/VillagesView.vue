<script setup lang="ts">
import type { AppSupabaseClient } from '../../types/database';
import { computed, onMounted, ref } from 'vue';
import {
  eventDefaultsFromVillage,
  formatVillageDate,
  loadVillages,
  updateVillageStatus,
  type Village,
  type VillageStatus,
  villageFilters,
  villageStatusLabels,
} from '../villages';

const props = defineProps<{
  client: AppSupabaseClient;
}>();

const emit = defineEmits<{
  refreshBadges: [];
}>();

const filter = ref<VillageStatus>('all');
const villages = ref<Village[]>([]);
const error = ref('');
const isLoading = ref(true);
const updatingId = ref<string | null>(null);
const eventDraft = ref<ReturnType<typeof eventDefaultsFromVillage> | null>(null);

const filteredVillages = computed(() => {
  if (filter.value === 'all') return villages.value;
  return villages.value.filter((village) => (village.statut || 'nouveau') === filter.value);
});

async function refresh() {
  isLoading.value = true;
  error.value = '';

  try {
    villages.value = await loadVillages(props.client);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de charger les demandes.';
  } finally {
    isLoading.value = false;
  }
}

async function setStatus(village: Village, status: Exclude<VillageStatus, 'all'>) {
  updatingId.value = village.id;
  error.value = '';

  try {
    await updateVillageStatus(props.client, village.id, status);
    village.statut = status;
    emit('refreshBadges');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de mettre à jour le statut.';
  } finally {
    updatingId.value = null;
  }
}

function prepareEvent(village: Village) {
  eventDraft.value = eventDefaultsFromVillage(village);
}

function statusFor(village: Village) {
  return village.statut || 'nouveau';
}

onMounted(refresh);
</script>

<template>
  <div class="view">
    <div class="view-header">
      <div>
        <h1>Demandes de villages</h1>
        <p class="view-subtitle">Suivez les communes candidates et qualifiez les demandes entrantes.</p>
      </div>
      <div class="view-actions">
        <button class="btn btn-outline" type="button" :disabled="isLoading" @click="refresh">
          {{ isLoading ? 'Actualisation...' : 'Actualiser' }}
        </button>
      </div>
    </div>

    <div class="filter-bar">
      <button
        v-for="item in villageFilters"
        :key="item.value"
        class="filter-btn"
        :class="{ active: filter === item.value }"
        type="button"
        @click="filter = item.value"
      >
        {{ item.label }}
      </button>
    </div>

    <div v-if="error" class="admin-inline-error" role="alert">
      {{ error }}
    </div>

    <div v-if="eventDraft" class="admin-event-draft">
      <div>
        <strong>Événement préparé :</strong>
        {{ eventDraft.titre }} · {{ eventDraft.lieu }}
        <span v-if="eventDraft.date_debut">· {{ formatVillageDate(eventDraft.date_debut) }}</span>
      </div>
      <p>
        La création complète sera branchée avec la migration de la vue planning. Les valeurs sont prêtes et alignées avec le legacy.
      </p>
      <button class="btn btn-ghost btn-sm" type="button" @click="eventDraft = null">Fermer</button>
    </div>

    <div v-if="isLoading" class="empty-state">
      <span class="empty-icon">🏘️</span>
      <h3>Chargement des demandes...</h3>
    </div>

    <div v-else-if="filteredVillages.length === 0" class="empty-state">
      <span class="empty-icon">🏘️</span>
      <h3>Aucune demande</h3>
      <p>Aucune commune ne correspond au filtre sélectionné.</p>
    </div>

    <div v-else class="request-list">
      <article v-for="village in filteredVillages" :key="village.id" class="request-card">
        <div class="request-header">
          <div>
            <h3>
              {{ village.nom }}
              <span class="status-badge" :class="`status-${statusFor(village)}`">
                {{ villageStatusLabels[statusFor(village)] }}
              </span>
            </h3>
            <div class="request-meta">
              {{ formatVillageDate(village.created_at.slice(0, 10)) }} · {{ village.code_postal }}
            </div>
          </div>
        </div>

        <div class="request-details">
          <div class="request-detail"><strong>Contact :</strong> {{ village.contact_nom }}</div>
          <div class="request-detail"><strong>Email :</strong> {{ village.contact_email }}</div>
          <div class="request-detail"><strong>Tél :</strong> {{ village.contact_telephone }}</div>
          <div class="request-detail"><strong>Habitants :</strong> {{ village.nombre_habitants }}</div>
          <div v-if="village.date_souhaitee" class="request-detail">
            <strong>Date souhaitée :</strong> {{ formatVillageDate(village.date_souhaitee) }}
          </div>
        </div>

        <div v-if="village.message" class="request-message">
          {{ village.message }}
        </div>

        <div class="request-actions">
          <template v-if="statusFor(village) === 'nouveau'">
            <button
              class="btn btn-success btn-sm"
              type="button"
              :disabled="updatingId === village.id"
              @click="setStatus(village, 'accepte')"
            >
              Accepter
            </button>
            <button
              class="btn btn-outline btn-sm"
              type="button"
              :disabled="updatingId === village.id"
              @click="setStatus(village, 'contacte')"
            >
              Contacté
            </button>
            <button
              class="btn btn-danger btn-sm"
              type="button"
              :disabled="updatingId === village.id"
              @click="setStatus(village, 'refuse')"
            >
              Refuser
            </button>
          </template>

          <template v-else-if="statusFor(village) === 'contacte'">
            <button
              class="btn btn-success btn-sm"
              type="button"
              :disabled="updatingId === village.id"
              @click="setStatus(village, 'accepte')"
            >
              Accepter
            </button>
            <button
              class="btn btn-danger btn-sm"
              type="button"
              :disabled="updatingId === village.id"
              @click="setStatus(village, 'refuse')"
            >
              Refuser
            </button>
          </template>

          <template v-else-if="statusFor(village) === 'accepte'">
            <button class="btn btn-primary btn-sm" type="button" @click="prepareEvent(village)">
              Créer un événement
            </button>
          </template>

          <template v-else>
            <button
              class="btn btn-outline btn-sm"
              type="button"
              :disabled="updatingId === village.id"
              @click="setStatus(village, 'nouveau')"
            >
              Réouvrir
            </button>
          </template>
        </div>
      </article>
    </div>
  </div>
</template>
