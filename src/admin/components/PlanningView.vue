<script setup lang="ts">
import type { AppSupabaseClient } from '../../types/database';
import { computed, onMounted, reactive, ref } from 'vue';
import {
  addDays,
  dayNames,
  deleteEvent,
  emptyEventForm,
  eventStatusLabels,
  formatDate,
  formatDateFr,
  formFromEvent,
  getMonday,
  isEventOnDay,
  isSameDay,
  loadEvents,
  saveEvent,
  type EventFormData,
  type PlanningEvent,
} from '../planning';
import { loadVehicules, type Vehicule } from '../vehicules';
import { loadVillages, type Village } from '../villages';

const props = defineProps<{
  client: AppSupabaseClient;
}>();

const emit = defineEmits<{
  refreshBadges: [];
}>();

const weekStart = ref(getMonday(new Date()));
const events = ref<PlanningEvent[]>([]);
const vehicules = ref<Vehicule[]>([]);
const villages = ref<Village[]>([]);
const error = ref('');
const isLoading = ref(true);
const isSaving = ref(false);
const editing = ref<PlanningEvent | null>(null);
const isFormOpen = ref(false);
const form = reactive<EventFormData>(emptyEventForm());

const days = computed(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart.value, index)));
const activeVehicules = computed(() => vehicules.value.filter((vehicule) => vehicule.actif));
const weekLabel = computed(() => {
  const start = weekStart.value;
  const end = addDays(start, 6);
  return `${formatDateFr(start)} — ${formatDateFr(end)} ${end.getFullYear()}`;
});

async function refresh() {
  isLoading.value = true;
  error.value = '';

  try {
    const [nextVehicules, nextVillages, nextEvents] = await Promise.all([
      loadVehicules(props.client),
      loadVillages(props.client),
      loadEvents(props.client, weekStart.value),
    ]);
    vehicules.value = nextVehicules;
    villages.value = nextVillages;
    events.value = nextEvents;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de charger le planning.';
  } finally {
    isLoading.value = false;
  }
}

async function navigateWeek(offset: number) {
  weekStart.value = addDays(weekStart.value, offset * 7);
  await refresh();
}

async function goToToday() {
  weekStart.value = getMonday(new Date());
  await refresh();
}

function eventsFor(vehicule: Vehicule, day: Date) {
  return events.value.filter((event) => event.vehicule_id === vehicule.id && isEventOnDay(event, day));
}

function openCreate(date = formatDate(new Date()), vehiculeId = activeVehicules.value[0]?.id || '') {
  Object.assign(form, emptyEventForm(date, vehiculeId));
  editing.value = null;
  isFormOpen.value = true;
}

function openEdit(event: PlanningEvent) {
  Object.assign(form, formFromEvent(event));
  editing.value = event;
  isFormOpen.value = true;
}

function closeForm() {
  isFormOpen.value = false;
  editing.value = null;
}

async function submit() {
  if (!form.titre.trim() || !form.lieu.trim() || !form.date_debut || !form.date_fin) {
    error.value = 'Titre, lieu et dates sont obligatoires.';
    return;
  }

  isSaving.value = true;
  error.value = '';

  try {
    await saveEvent(props.client, form, editing.value?.id);
    closeForm();
    await refresh();
    emit('refreshBadges');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible d’enregistrer l’événement.';
  } finally {
    isSaving.value = false;
  }
}

async function removeCurrentEvent() {
  if (!editing.value || !window.confirm('Supprimer cet événement ?')) return;
  error.value = '';

  try {
    await deleteEvent(props.client, editing.value.id);
    closeForm();
    await refresh();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de supprimer l’événement.';
  }
}

onMounted(refresh);
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h1>Planning</h1>
      <div class="view-actions">
        <button class="btn btn-primary" type="button" @click="openCreate()">+ Événement</button>
      </div>
    </div>

    <div class="planning-toolbar">
      <div class="planning-nav">
        <button class="btn btn-icon" type="button" title="Semaine précédente" @click="navigateWeek(-1)">‹</button>
        <button class="btn btn-outline" type="button" @click="goToToday">Aujourd'hui</button>
        <button class="btn btn-icon" type="button" title="Semaine suivante" @click="navigateWeek(1)">›</button>
      </div>
      <span class="planning-week-label">{{ weekLabel }}</span>
    </div>

    <div v-if="error" class="admin-inline-error" role="alert">{{ error }}</div>

    <form v-if="isFormOpen" class="admin-form admin-inline-form" @submit.prevent="submit">
      <h2>{{ editing ? "Modifier l'événement" : 'Nouvel événement' }}</h2>
      <div class="form-group">
        <label for="event-title">Titre *</label>
        <input id="event-title" v-model="form.titre" type="text" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="event-vehicule">Véhicule *</label>
          <select id="event-vehicule" v-model="form.vehicule_id" required>
            <option value="">— Choisir —</option>
            <option v-for="vehicule in activeVehicules" :key="vehicule.id" :value="vehicule.id">
              {{ vehicule.nom }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label for="event-status">Statut</label>
          <select id="event-status" v-model="form.statut">
            <option v-for="(label, value) in eventStatusLabels" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label for="event-lieu">Lieu *</label>
        <input id="event-lieu" v-model="form.lieu" type="text" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="event-start">Date début *</label>
          <input id="event-start" v-model="form.date_debut" type="date" required>
        </div>
        <div class="form-group">
          <label for="event-end">Date fin *</label>
          <input id="event-end" v-model="form.date_fin" type="date" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="event-people">Nb personnes prévu</label>
          <input id="event-people" v-model.number="form.nb_personnes_prevu" type="number" min="1">
        </div>
        <div class="form-group">
          <label for="event-village">Village associé</label>
          <select id="event-village" v-model="form.village_id">
            <option value="">— Aucun —</option>
            <option v-for="village in villages" :key="village.id" :value="village.id">
              {{ village.nom }} ({{ village.code_postal }})
            </option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label for="event-notes">Notes</label>
        <textarea id="event-notes" v-model="form.notes" rows="3" />
      </div>
      <div class="form-actions">
        <button v-if="editing" class="btn btn-danger btn-sm" type="button" @click="removeCurrentEvent">Supprimer</button>
        <div style="flex:1"></div>
        <button class="btn btn-outline" type="button" @click="closeForm">Annuler</button>
        <button class="btn btn-primary" type="submit" :disabled="isSaving">
          {{ isSaving ? 'Enregistrement...' : editing ? 'Enregistrer' : 'Créer' }}
        </button>
      </div>
    </form>

    <div v-if="isLoading" class="empty-state">
      <span class="empty-icon">🚐</span>
      <h3>Chargement du planning...</h3>
    </div>

    <div v-else-if="activeVehicules.length === 0" class="empty-state">
      <span class="empty-icon">🚐</span>
      <h3>Aucun véhicule</h3>
      <p>Créez un véhicule pour commencer à planifier vos événements.</p>
    </div>

    <div v-else class="planning-scroll">
      <div class="planning-table">
        <div class="planning-header" style="display:contents">
          <div class="planning-cell planning-empty-corner" />
          <div
            v-for="day in days"
            :key="formatDate(day)"
            class="planning-cell planning-day-header"
            :class="{ 'is-today': isSameDay(day, new Date()) }"
          >
            <span class="day-name">{{ dayNames[day.getDay()] }}</span>
            <span class="day-date">{{ day.getDate() }}/{{ day.getMonth() + 1 }}</span>
          </div>
        </div>

        <template v-for="vehicule in activeVehicules" :key="vehicule.id">
          <div class="planning-cell planning-vehicle-cell">
            <span class="vehicle-dot" :style="{ background: vehicule.couleur }" />
            <span>{{ vehicule.nom }}</span>
          </div>
          <div
            v-for="day in days"
            :key="`${vehicule.id}-${formatDate(day)}`"
            class="planning-cell planning-day-cell"
            :class="{ 'is-today': isSameDay(day, new Date()) }"
            @click="openCreate(formatDate(day), vehicule.id)"
          >
            <div
              v-for="event in eventsFor(vehicule, day)"
              :key="event.id"
              class="event-badge"
              :class="`event-${event.statut}`"
              :title="`${event.titre} - ${event.lieu}`"
              @click.stop="openEdit(event)"
            >
              <span class="event-title">{{ event.titre }}</span>
              <span class="event-lieu">{{ event.lieu }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
