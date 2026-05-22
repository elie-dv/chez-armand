<script setup lang="ts">
import type { AppSupabaseClient } from '../../types/database';
import { computed, onMounted, reactive, ref } from 'vue';
import { loadJeunes, type Jeune } from '../jeunes';
import {
  addEquipeMember,
  deleteVehicule,
  emptyVehiculeForm,
  formFromVehicule,
  loadEquipeByVehicle,
  loadVehicules,
  removeEquipeMember,
  saveVehicule,
  type EquipeMembre,
  type Vehicule,
} from '../vehicules';

const props = defineProps<{
  client: AppSupabaseClient;
}>();

const emit = defineEmits<{
  refreshBadges: [];
}>();

const vehicules = ref<Vehicule[]>([]);
const membersByVehicle = ref<Record<string, EquipeMembre[]>>({});
const jeunes = ref<Jeune[]>([]);
const error = ref('');
const isLoading = ref(true);
const isSaving = ref(false);
const editing = ref<Vehicule | null>(null);
const form = reactive({ ...emptyVehiculeForm });
const addingMemberFor = ref<string | null>(null);
const selectedJeuneId = ref('');

const acceptedJeunes = computed(() => jeunes.value.filter((jeune) => jeune.statut === 'accepte'));

function resetForm() {
  Object.assign(form, emptyVehiculeForm);
  editing.value = null;
}

function editVehicule(vehicule: Vehicule) {
  editing.value = vehicule;
  Object.assign(form, formFromVehicule(vehicule));
}

async function refresh() {
  isLoading.value = true;
  error.value = '';

  try {
    const [nextVehicules, nextJeunes] = await Promise.all([
      loadVehicules(props.client),
      loadJeunes(props.client),
    ]);
    vehicules.value = nextVehicules;
    jeunes.value = nextJeunes;
    membersByVehicle.value = await loadEquipeByVehicle(props.client, nextVehicules);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de charger les véhicules.';
  } finally {
    isLoading.value = false;
  }
}

async function submit() {
  if (!form.nom.trim()) {
    error.value = 'Le nom du véhicule est obligatoire.';
    return;
  }

  isSaving.value = true;
  error.value = '';

  try {
    await saveVehicule(props.client, form, editing.value?.id);
    resetForm();
    await refresh();
    emit('refreshBadges');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible d’enregistrer le véhicule.';
  } finally {
    isSaving.value = false;
  }
}

async function removeVehicule(vehicule: Vehicule) {
  if (!window.confirm(`Supprimer ${vehicule.nom} ?`)) return;
  error.value = '';

  try {
    await deleteVehicule(props.client, vehicule.id);
    await refresh();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de supprimer le véhicule.';
  }
}

function openAddMember(vehiculeId: string) {
  addingMemberFor.value = vehiculeId;
  selectedJeuneId.value = availableJeunes(vehiculeId)[0]?.id || '';
}

function availableJeunes(vehiculeId: string) {
  const existing = new Set((membersByVehicle.value[vehiculeId] || []).map((member) => member.jeune_id));
  return acceptedJeunes.value.filter((jeune) => !existing.has(jeune.id));
}

async function addMember(vehiculeId: string) {
  if (!selectedJeuneId.value) return;
  error.value = '';

  try {
    await addEquipeMember(props.client, vehiculeId, selectedJeuneId.value);
    addingMemberFor.value = null;
    selectedJeuneId.value = '';
    membersByVehicle.value = await loadEquipeByVehicle(props.client, vehicules.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible d’ajouter le membre.';
  }
}

async function removeMember(memberId: string) {
  error.value = '';

  try {
    await removeEquipeMember(props.client, memberId);
    membersByVehicle.value = await loadEquipeByVehicle(props.client, vehicules.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de retirer le membre.';
  }
}

onMounted(refresh);
</script>

<template>
  <div class="view">
    <div class="view-header">
      <div>
        <h1>Véhicules</h1>
        <p class="view-subtitle">Gérez les véhicules et les équipes associées.</p>
      </div>
      <div class="view-actions">
        <button class="btn btn-outline" type="button" :disabled="isLoading" @click="refresh">
          Actualiser
        </button>
      </div>
    </div>

    <div v-if="error" class="admin-inline-error" role="alert">{{ error }}</div>

    <form class="admin-form admin-inline-form" @submit.prevent="submit">
      <h2>{{ editing ? 'Modifier le véhicule' : 'Nouveau véhicule' }}</h2>
      <div class="form-row">
        <div class="form-group">
          <label for="vehicule-nom">Nom *</label>
          <input id="vehicule-nom" v-model="form.nom" type="text" required>
        </div>
        <div class="form-group">
          <label for="vehicule-type">Type</label>
          <select id="vehicule-type" v-model="form.type">
            <option value="van">Van</option>
            <option value="camion">Camion</option>
            <option value="camionnette">Camionnette</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div class="form-group">
          <label for="vehicule-couleur">Couleur</label>
          <input id="vehicule-couleur" v-model="form.couleur" type="color">
        </div>
      </div>
      <div class="form-group">
        <label for="vehicule-description">Description</label>
        <textarea id="vehicule-description" v-model="form.description" rows="2" />
      </div>
      <label class="admin-checkbox-row">
        <input v-model="form.actif" type="checkbox">
        Actif
      </label>
      <div class="form-actions">
        <button v-if="editing" class="btn btn-outline" type="button" @click="resetForm">Annuler</button>
        <button class="btn btn-primary" type="submit" :disabled="isSaving">
          {{ isSaving ? 'Enregistrement...' : editing ? 'Enregistrer' : 'Créer' }}
        </button>
      </div>
    </form>

    <div v-if="isLoading" class="empty-state">
      <span class="empty-icon">🚐</span>
      <h3>Chargement des véhicules...</h3>
    </div>

    <div v-else-if="vehicules.length === 0" class="empty-state">
      <span class="empty-icon">🚐</span>
      <h3>Aucun véhicule</h3>
      <p>Ajoutez votre premier véhicule pour commencer.</p>
    </div>

    <div v-else class="vehicule-cards">
      <article
        v-for="vehicule in vehicules"
        :key="vehicule.id"
        class="vehicule-card"
        :class="{ 'vehicule-inactive': !vehicule.actif }"
      >
        <div class="vehicule-card-header">
          <div class="vehicule-color-bar" :style="{ background: vehicule.couleur }" />
          <div class="vehicule-card-info">
            <h3>{{ vehicule.nom }}</h3>
            <span class="vehicule-type">{{ vehicule.type }}{{ vehicule.actif ? '' : ' — Inactif' }}</span>
          </div>
          <div class="vehicule-card-actions">
            <button class="btn btn-ghost btn-sm" type="button" @click="editVehicule(vehicule)">Modifier</button>
            <button class="btn btn-ghost btn-sm" type="button" @click="removeVehicule(vehicule)">Supprimer</button>
          </div>
        </div>

        <div class="vehicule-card-body">
          <p v-if="vehicule.description" class="vehicule-description">{{ vehicule.description }}</p>
          <div class="team-section">
            <h4>Équipe ({{ membersByVehicle[vehicule.id]?.length || 0 }})</h4>
            <div class="team-members">
              <span
                v-for="member in membersByVehicle[vehicule.id] || []"
                :key="member.id"
                class="team-member"
              >
                {{ member.jeunes?.prenom }} {{ member.jeunes?.nom }}
                <button class="remove-member" type="button" title="Retirer" @click="removeMember(member.id)">
                  &times;
                </button>
              </span>
              <button
                v-if="availableJeunes(vehicule.id).length > 0"
                class="add-member-btn"
                type="button"
                @click="openAddMember(vehicule.id)"
              >
                + Ajouter
              </button>
            </div>

            <div v-if="addingMemberFor === vehicule.id" class="admin-mini-form">
              <select v-model="selectedJeuneId">
                <option
                  v-for="jeune in availableJeunes(vehicule.id)"
                  :key="jeune.id"
                  :value="jeune.id"
                >
                  {{ jeune.prenom }} {{ jeune.nom }} ({{ jeune.age }} ans)
                </option>
              </select>
              <button class="btn btn-primary btn-sm" type="button" @click="addMember(vehicule.id)">Ajouter</button>
              <button class="btn btn-outline btn-sm" type="button" @click="addingMemberFor = null">Annuler</button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
