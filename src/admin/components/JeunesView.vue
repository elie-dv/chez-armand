<script setup lang="ts">
import type { AppSupabaseClient } from '../../types/database';
import { computed, onMounted, ref } from 'vue';
import {
  jeuneFilters,
  jeuneStatusLabels,
  loadJeunes,
  updateJeuneStatus,
  type Jeune,
  type JeuneStatus,
} from '../jeunes';
import { formatVillageDate } from '../villages';

const props = defineProps<{
  client: AppSupabaseClient;
}>();

const emit = defineEmits<{
  refreshBadges: [];
}>();

const filter = ref<JeuneStatus>('all');
const jeunes = ref<Jeune[]>([]);
const error = ref('');
const isLoading = ref(true);
const updatingId = ref<string | null>(null);

const filteredJeunes = computed(() => {
  if (filter.value === 'all') return jeunes.value;
  return jeunes.value.filter((jeune) => (jeune.statut || 'nouveau') === filter.value);
});

async function refresh() {
  isLoading.value = true;
  error.value = '';

  try {
    jeunes.value = await loadJeunes(props.client);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de charger les candidatures.';
  } finally {
    isLoading.value = false;
  }
}

async function setStatus(jeune: Jeune, status: Exclude<JeuneStatus, 'all'>) {
  updatingId.value = jeune.id;
  error.value = '';

  try {
    await updateJeuneStatus(props.client, jeune.id, status);
    jeune.statut = status;
    emit('refreshBadges');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de mettre à jour le statut.';
  } finally {
    updatingId.value = null;
  }
}

function statusFor(jeune: Jeune) {
  return jeune.statut || 'nouveau';
}

onMounted(refresh);
</script>

<template>
  <div class="view">
    <div class="view-header">
      <div>
        <h1>Candidatures jeunes</h1>
        <p class="view-subtitle">Qualifiez les candidatures et préparez les équipes.</p>
      </div>
      <div class="view-actions">
        <button class="btn btn-outline" type="button" :disabled="isLoading" @click="refresh">
          {{ isLoading ? 'Actualisation...' : 'Actualiser' }}
        </button>
      </div>
    </div>

    <div class="filter-bar">
      <button
        v-for="item in jeuneFilters"
        :key="item.value"
        class="filter-btn"
        :class="{ active: filter === item.value }"
        type="button"
        @click="filter = item.value"
      >
        {{ item.label }}
      </button>
    </div>

    <div v-if="error" class="admin-inline-error" role="alert">{{ error }}</div>

    <div v-if="isLoading" class="empty-state">
      <span class="empty-icon">🙋</span>
      <h3>Chargement des candidatures...</h3>
    </div>

    <div v-else-if="filteredJeunes.length === 0" class="empty-state">
      <span class="empty-icon">🙋</span>
      <h3>Aucune candidature</h3>
      <p>Aucune candidature ne correspond au filtre sélectionné.</p>
    </div>

    <div v-else class="request-list">
      <article v-for="jeune in filteredJeunes" :key="jeune.id" class="request-card">
        <div class="request-header">
          <div>
            <h3>
              {{ jeune.prenom }} {{ jeune.nom }}
              <span class="status-badge" :class="`status-${statusFor(jeune)}`">
                {{ jeuneStatusLabels[statusFor(jeune)] }}
              </span>
            </h3>
            <div class="request-meta">
              {{ formatVillageDate(jeune.created_at.slice(0, 10)) }} · {{ jeune.age }} ans
            </div>
          </div>
        </div>

        <div class="request-details">
          <div class="request-detail"><strong>Email :</strong> {{ jeune.email }}</div>
          <div class="request-detail"><strong>Tél :</strong> {{ jeune.telephone }}</div>
        </div>

        <div class="request-message">{{ jeune.motivation }}</div>

        <div class="request-actions">
          <template v-if="statusFor(jeune) === 'nouveau'">
            <button
              class="btn btn-success btn-sm"
              type="button"
              :disabled="updatingId === jeune.id"
              @click="setStatus(jeune, 'accepte')"
            >
              Accepter
            </button>
            <button
              class="btn btn-danger btn-sm"
              type="button"
              :disabled="updatingId === jeune.id"
              @click="setStatus(jeune, 'refuse')"
            >
              Refuser
            </button>
          </template>

          <template v-else-if="statusFor(jeune) === 'accepte'">
            <button
              class="btn btn-outline btn-sm"
              type="button"
              :disabled="updatingId === jeune.id"
              @click="setStatus(jeune, 'refuse')"
            >
              Refuser
            </button>
          </template>

          <template v-else>
            <button
              class="btn btn-outline btn-sm"
              type="button"
              :disabled="updatingId === jeune.id"
              @click="setStatus(jeune, 'nouveau')"
            >
              Réouvrir
            </button>
          </template>
        </div>
      </article>
    </div>
  </div>
</template>
