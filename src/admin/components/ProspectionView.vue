<script setup lang="ts">
import type { AppSupabaseClient } from '../../types/database';
import * as L from 'leaflet';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import {
  buildProspectionEmail,
  callAdminFunction,
  createInitialProspectionArea,
  createPolygonProspectionArea,
  departmentFilters,
  emptyManualProspection,
  loadProspection,
  prospectionFilters,
  prospectionStatusLabels,
  saveManualProspection,
  sendProspectionEmail,
  updateProspectionRecord,
  type ProspectionRecord,
  type ProspectionStatus,
  type ScanResult,
} from '../prospection';

const props = defineProps<{
  client: AppSupabaseClient;
}>();

const emit = defineEmits<{
  refreshBadges: [];
}>();

const records = ref<ProspectionRecord[]>([]);
const error = ref('');
const isLoading = ref(true);
const statusFilter = ref<'all' | ProspectionStatus>('all');
const deptFilter = ref('all');
const search = ref('');
const isManualOpen = ref(false);
const manualForm = reactive(emptyManualProspection());
const selectedRecord = ref<ProspectionRecord | null>(null);
const emailPreview = ref<ReturnType<typeof buildProspectionEmail> | null>(null);
const scanRunning = ref(false);
const emailSending = ref(false);
const scanStatus = ref('');
const scanProgress = ref(0);
let scanStatusTimer: number | null = null;
const mairieSources = ref(['api-lannuaire', 'etablissements-publics']);
const areaName = ref('Zone personnalisée');
const mapEl = ref<HTMLElement | null>(null);
const map = shallowRef<L.Map | null>(null);
const markerLayers = shallowRef<L.Layer[]>([]);
const draftLayers = shallowRef<L.Layer[]>([]);
const drawing = ref(false);
const draftPoints = ref<Array<{ lat: number; lng: number }>>([]);
const selectedPoint = ref<number | null>(null);

function clearScanStatusTimer() {
  if (scanStatusTimer !== null) {
    window.clearTimeout(scanStatusTimer);
    scanStatusTimer = null;
  }
}

function showScanStatus(label: string, progress: number) {
  clearScanStatusTimer();
  scanStatus.value = label;
  scanProgress.value = Math.max(0, Math.min(100, progress));
}

function completeScanStatus(label = 'Scan terminé.') {
  showScanStatus(label, 100);
  scanStatusTimer = window.setTimeout(() => {
    scanStatus.value = '';
    scanProgress.value = 0;
    scanStatusTimer = null;
  }, 5000);
}

const filteredRecords = computed(() => {
  const term = search.value.toLowerCase().trim();
  return records.value.filter((item) => {
    const m = item.municipality;
    const e = item.enrichment || {};
    const haystack = `${m.nom} ${m.insee_code} ${m.code_postal || ''} ${e.mairie_email || ''}`.toLowerCase();
    return (
      (statusFilter.value === 'all' || item.statut === statusFilter.value) &&
      (deptFilter.value === 'all' || m.department_code === deptFilter.value) &&
      (!term || haystack.includes(term))
    );
  });
});

const stats = computed(() => ({
  total: records.value.length,
  ready: records.value.filter((item) => item.statut === 'ready_to_contact').length,
  sent: records.value.filter((item) => item.statut === 'email_sent').length,
  toCall: records.value.filter((item) => item.statut === 'to_call').length,
  interested: records.value.filter((item) => item.statut === 'interested').length,
}));

async function refresh() {
  isLoading.value = true;
  error.value = '';

  try {
    records.value = await loadProspection(props.client);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de charger la prospection.';
  } finally {
    isLoading.value = false;
  }
}

function clearLayers(layers: L.Layer[]) {
  layers.forEach((layer) => layer.remove());
  layers.splice(0, layers.length);
}

function initMap() {
  if (!mapEl.value || map.value) return;

  map.value = L.map(mapEl.value, { scrollWheelZoom: true }).setView([48.05, -2.2], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map.value);

  map.value.on('click', (event: L.LeafletMouseEvent) => {
    if (!drawing.value) return;
    addDraftPoint(event.latlng.lat, event.latlng.lng);
  });

  renderMapMarkers();
}

function renderMapMarkers() {
  if (!map.value) return;
  clearLayers(markerLayers.value);

  const points = filteredRecords.value.filter((record) => record.municipality.latitude && record.municipality.longitude);
  points.forEach((record) => {
    const marker = L.circleMarker([
      Number(record.municipality.latitude),
      Number(record.municipality.longitude),
    ], {
      radius: 8,
      color: '#8B4513',
      fillColor: '#8B4513',
      fillOpacity: 0.85,
      weight: 2,
    }).addTo(map.value!);

    marker.bindPopup(`<strong>${record.municipality.nom}</strong><br>${prospectionStatusLabels[record.statut]}`);
    marker.on('click', () => {
      if (!drawing.value) selectedRecord.value = { ...record };
    });
    markerLayers.value.push(marker);
  });

  window.setTimeout(() => {
    map.value?.invalidateSize();
    if (markerLayers.value.length > 0) {
      const group = L.featureGroup(markerLayers.value);
      map.value?.fitBounds(group.getBounds().pad(0.15), { maxZoom: 10 });
    }
    renderDraftZone();
  }, 50);
}

function addDraftPoint(lat: number, lng: number, index: number | null = null) {
  const point = { lat: Number(lat), lng: Number(lng) };
  if (index === null || index >= draftPoints.value.length) {
    draftPoints.value.push(point);
    selectedPoint.value = draftPoints.value.length - 1;
  } else {
    draftPoints.value.splice(index, 0, point);
    selectedPoint.value = index;
  }
  renderDraftZone();
}

function updateDraftPoint(index: number, latlng: L.LatLng) {
  if (!draftPoints.value[index]) return;
  draftPoints.value[index] = { lat: latlng.lat, lng: latlng.lng };
  renderDraftZone();
}

function deleteSelectedPoint() {
  if (selectedPoint.value === null) return;
  draftPoints.value.splice(selectedPoint.value, 1);
  selectedPoint.value = draftPoints.value.length
    ? Math.min(selectedPoint.value, draftPoints.value.length - 1)
    : null;
  renderDraftZone();
}

function clearDraftZone() {
  draftPoints.value = [];
  selectedPoint.value = null;
  drawing.value = false;
  renderDraftZone();
}

function renderDraftZone() {
  if (!map.value) return;
  clearLayers(draftLayers.value);

  const points = draftPoints.value.map((point) => [point.lat, point.lng] as [number, number]);
  if (points.length >= 3) {
    draftLayers.value.push(L.polygon(points, {
      color: '#24D3A2',
      fillColor: '#24D3A2',
      fillOpacity: 0.18,
      weight: 3,
      dashArray: '8 8',
    }).addTo(map.value));
  } else if (points.length >= 2) {
    draftLayers.value.push(L.polyline(points, {
      color: '#24D3A2',
      weight: 3,
      dashArray: '8 8',
    }).addTo(map.value));
  }

  draftPoints.value.forEach((point, index) => {
    const marker = L.marker([point.lat, point.lng], {
      draggable: true,
      icon: L.divIcon({
        className: `zone-vertex${selectedPoint.value === index ? ' selected' : ''}`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
      zIndexOffset: 2000,
    }).addTo(map.value!);

    marker.on('click', (event: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event.originalEvent);
      selectedPoint.value = index;
      renderDraftZone();
    });
    marker.on('dragend', () => updateDraftPoint(index, marker.getLatLng()));
    draftLayers.value.push(marker);
  });

  if (draftPoints.value.length >= 2) {
    const segmentCount = draftPoints.value.length >= 3 ? draftPoints.value.length : draftPoints.value.length - 1;
    for (let i = 0; i < segmentCount; i += 1) {
      const a = draftPoints.value[i];
      const b = draftPoints.value[(i + 1) % draftPoints.value.length];
      const midpoint = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
      const marker = L.marker([midpoint.lat, midpoint.lng], {
        icon: L.divIcon({
          className: 'zone-midpoint',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        }),
        zIndexOffset: 1500,
      }).addTo(map.value);
      marker.on('click', (event: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(event.originalEvent);
        addDraftPoint(midpoint.lat, midpoint.lng, i + 1);
      });
      draftLayers.value.push(marker);
    }
  }
}

async function setStatus(record: ProspectionRecord, status: ProspectionStatus) {
  error.value = '';

  try {
    await updateProspectionRecord(props.client, record.id, { statut: status });
    record.statut = status;
    emit('refreshBadges');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de mettre à jour le statut.';
  }
}

async function submitManual() {
  if (!manualForm.nom.trim() || !manualForm.insee_code.trim() || !manualForm.department_code) {
    error.value = 'Nom, code INSEE et département sont obligatoires.';
    return;
  }

  error.value = '';
  try {
    await saveManualProspection(props.client, manualForm);
    Object.assign(manualForm, emptyManualProspection());
    isManualOpen.value = false;
    await refresh();
    emit('refreshBadges');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible d’ajouter la commune.';
  }
}

async function saveDetails() {
  if (!selectedRecord.value) return;
  error.value = '';

  try {
    await updateProspectionRecord(props.client, selectedRecord.value.id, {
      statut: selectedRecord.value.statut,
      notes: selectedRecord.value.notes,
      next_action_at: selectedRecord.value.next_action_at,
    });
    selectedRecord.value = null;
    await refresh();
    emit('refreshBadges');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible d’enregistrer la commune.';
  }
}

async function openEmail(record: ProspectionRecord) {
  emailPreview.value = buildProspectionEmail(record);
  selectedRecord.value = record;
  if (['to_review', 'ready_to_contact'].includes(record.statut)) {
    await setStatus(record, 'email_previewed');
  }
}

async function sendCurrentEmail() {
  if (!selectedRecord.value || !emailPreview.value) return;
  emailSending.value = true;
  error.value = '';

  try {
    await sendProspectionEmail(props.client, selectedRecord.value, emailPreview.value);
    emailPreview.value = null;
    selectedRecord.value = null;
    await refresh();
    emit('refreshBadges');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible d’envoyer l’email.';
  } finally {
    emailSending.value = false;
  }
}

async function runScan() {
  if (scanRunning.value) return;
  scanRunning.value = true;
  showScanStatus('Préparation du scan...', 0);
  error.value = '';

  try {
    const area = await createInitialProspectionArea(props.client, mairieSources.value);
    let jobId: string | null = null;
    let result: ScanResult | null = null;
    do {
      showScanStatus(jobId ? 'Analyse du lot suivant...' : 'Création du job...', scanProgress.value);
      result = await callAdminFunction<ScanResult>(props.client, 'scan-prospection-area', {
        area_id: jobId ? undefined : area.id,
        job_id: jobId,
        batch_size: 2,
      }, 90_000);
      if (!result) throw new Error('La fonction de scan n’a pas renvoyé de résultat.');
      jobId = result.job_id;
      showScanStatus(
        `${result.processed_candidates || 0}/${result.total_candidates || 0} communes analysées · ${result.saved_count || 0} ajoutées`,
        result.progress || 0,
      );
      await refresh();
    } while (result?.has_more);
    completeScanStatus();
    emit('refreshBadges');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Le scan automatique a échoué.';
  } finally {
    scanRunning.value = false;
  }
}

async function runPolygonScan() {
  if (scanRunning.value || draftPoints.value.length < 3) return;
  scanRunning.value = true;
  showScanStatus('Sauvegarde de la zone...', 0);
  error.value = '';

  try {
    const area = await createPolygonProspectionArea(props.client, areaName.value, draftPoints.value, mairieSources.value);
    clearDraftZone();
    await runScanForArea(area.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de lancer le scan de zone.';
  } finally {
    scanRunning.value = false;
  }
}

async function runScanForArea(areaId: string) {
  let jobId: string | null = null;
  let result: ScanResult | null = null;
  do {
    showScanStatus(jobId ? 'Analyse du lot suivant...' : 'Création du job...', scanProgress.value);
    result = await callAdminFunction<ScanResult>(props.client, 'scan-prospection-area', {
      area_id: jobId ? undefined : areaId,
      job_id: jobId,
      batch_size: 2,
    }, 90_000);
    if (!result) throw new Error('La fonction de scan n’a pas renvoyé de résultat.');
    jobId = result.job_id;
    showScanStatus(
      `${result.processed_candidates || 0}/${result.total_candidates || 0} communes analysées · ${result.saved_count || 0} ajoutées`,
      result.progress || 0,
    );
    await refresh();
  } while (result?.has_more);
  completeScanStatus();
  emit('refreshBadges');
}

function commerceLabel(record: ProspectionRecord) {
  const count = record.enrichment.commerce_count;
  return count === null || count === undefined ? '—' : String(count);
}

watch(filteredRecords, () => renderMapMarkers());
watch(draftPoints, () => renderDraftZone(), { deep: true });

onMounted(async () => {
  await refresh();
  await nextTick();
  initMap();
});

onBeforeUnmount(() => {
  clearScanStatusTimer();
  clearLayers(markerLayers.value);
  clearLayers(draftLayers.value);
  map.value?.remove();
  map.value = null;
});
</script>

<template>
  <div class="view">
    <div class="view-header">
      <div>
        <h1>Prospection communes</h1>
        <p class="view-subtitle">Communes de moins de 500 habitants avec peu de commerces estimés.</p>
      </div>
      <div class="view-actions">
        <button class="btn btn-outline" type="button" :disabled="isLoading" @click="refresh">Actualiser</button>
        <button class="btn btn-outline" type="button" @click="isManualOpen = !isManualOpen">+ Ajouter une commune</button>
        <button class="btn btn-primary" type="button" :disabled="scanRunning" @click="runScan">
          {{ scanRunning ? 'Scan en cours...' : 'Lancer la recherche 22/35/56' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="admin-inline-error" role="alert">{{ error }}</div>

    <div class="prospection-stats">
      <div class="metric-card"><span>{{ stats.total }}</span><label>Communes</label></div>
      <div class="metric-card"><span>{{ stats.ready }}</span><label>Prêtes</label></div>
      <div class="metric-card"><span>{{ stats.sent }}</span><label>Emails envoyés</label></div>
      <div class="metric-card"><span>{{ stats.toCall }}</span><label>À appeler</label></div>
      <div class="metric-card"><span>{{ stats.interested }}</span><label>Intéressées</label></div>
    </div>

    <div v-if="scanStatus" class="prospection-scan-status">
      <div class="scan-status-row">
        <span>{{ scanStatus }}</span>
        <strong>{{ scanProgress }}%</strong>
      </div>
      <div class="scan-progress"><span :style="{ width: `${scanProgress}%` }" /></div>
    </div>

    <form v-if="isManualOpen" class="admin-form admin-inline-form" @submit.prevent="submitManual">
      <h2>Ajouter une commune prospectée</h2>
      <div class="form-row">
        <div class="form-group">
          <label>Nom de la commune *</label>
          <input v-model="manualForm.nom" type="text" required>
        </div>
        <div class="form-group">
          <label>Code INSEE *</label>
          <input v-model="manualForm.insee_code" type="text" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Code postal</label>
          <input v-model="manualForm.code_postal" type="text">
        </div>
        <div class="form-group">
          <label>Département *</label>
          <select v-model="manualForm.department_code" required>
            <option value="">— Choisir —</option>
            <option value="22">Côtes-d’Armor</option>
            <option value="35">Ille-et-Vilaine</option>
            <option value="56">Morbihan</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Population</label>
          <input v-model.number="manualForm.population" type="number" min="0">
        </div>
        <div class="form-group">
          <label>Commerces estimés</label>
          <input v-model.number="manualForm.commerce_count" type="number" min="0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Email mairie</label>
          <input v-model="manualForm.mairie_email" type="email">
        </div>
        <div class="form-group">
          <label>Téléphone mairie</label>
          <input v-model="manualForm.mairie_phone" type="tel">
        </div>
      </div>
      <div class="form-group">
        <label>Horaires mairie</label>
        <textarea v-model="manualForm.mairie_opening_hours" rows="2" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Statut</label>
          <select v-model="manualForm.statut">
            <option v-for="(label, value) in prospectionStatusLabels" :key="value" :value="value">{{ label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Prochaine action</label>
          <input v-model="manualForm.next_action_at" type="date">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea v-model="manualForm.notes" rows="3" />
      </div>
      <div class="form-actions">
        <button class="btn btn-outline" type="button" @click="isManualOpen = false">Annuler</button>
        <button class="btn btn-primary" type="submit">Ajouter</button>
      </div>
    </form>

    <div class="prospection-controls">
      <input v-model="search" type="search" placeholder="Rechercher une commune..." class="prospection-search">
      <select v-model="deptFilter" class="prospection-select">
        <option v-for="item in departmentFilters" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
      <fieldset class="prospection-source-control" aria-label="Sources des infos mairie">
        <legend>Sources infos mairie</legend>
        <label><input v-model="mairieSources" type="checkbox" value="api-lannuaire"> Annuaire</label>
        <label><input v-model="mairieSources" type="checkbox" value="etablissements-publics"> Établissements publics</label>
      </fieldset>
      <div class="filter-bar compact">
        <button
          v-for="item in prospectionFilters"
          :key="item.value"
          class="filter-btn"
          :class="{ active: statusFilter === item.value }"
          type="button"
          @click="statusFilter = item.value"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <div class="prospection-map-panel">
      <div class="map-draw-toolbar">
        <input v-model="areaName" type="text" class="map-area-name" aria-label="Nom de la zone">
        <button
          class="btn btn-outline btn-sm"
          :class="{ 'active-draw': drawing }"
          type="button"
          @click="drawing = !drawing"
        >
          {{ drawing ? 'Terminer le dessin' : 'Dessiner une zone' }}
        </button>
        <button
          class="btn btn-outline btn-sm"
          type="button"
          :disabled="selectedPoint === null"
          @click="deleteSelectedPoint"
        >
          Supprimer point
        </button>
        <button
          class="btn btn-outline btn-sm"
          type="button"
          :disabled="draftPoints.length === 0"
          @click="clearDraftZone"
        >
          Effacer
        </button>
        <button
          class="btn btn-primary btn-sm"
          type="button"
          :disabled="draftPoints.length < 3 || scanRunning"
          @click="runPolygonScan"
        >
          Sauvegarder et lancer
        </button>
      </div>
      <div ref="mapEl" class="prospection-map" :class="{ 'is-drawing': drawing }" />
    </div>

    <div v-if="selectedRecord" class="admin-side-panel">
      <form class="admin-form" @submit.prevent="saveDetails">
        <h2>{{ selectedRecord.municipality.nom }}</h2>
        <div class="prospection-detail-grid">
          <div><strong>Code INSEE</strong><span>{{ selectedRecord.municipality.insee_code }}</span></div>
          <div><strong>Département</strong><span>{{ selectedRecord.municipality.department_code }}</span></div>
          <div><strong>Population</strong><span>{{ selectedRecord.municipality.population ?? '—' }}</span></div>
          <div><strong>Commerces</strong><span>{{ commerceLabel(selectedRecord) }}</span></div>
          <div><strong>Email mairie</strong><span>{{ selectedRecord.enrichment.mairie_email || 'Non renseigné' }}</span></div>
          <div><strong>Téléphone mairie</strong><span>{{ selectedRecord.enrichment.mairie_phone || 'Non renseigné' }}</span></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Statut</label>
            <select v-model="selectedRecord.statut">
              <option v-for="(label, value) in prospectionStatusLabels" :key="value" :value="value">{{ label }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Prochaine action</label>
            <input v-model="selectedRecord.next_action_at" type="date">
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea v-model="selectedRecord.notes" rows="4" />
        </div>
        <div class="form-actions">
          <button class="btn btn-outline" type="button" @click="emailPreview = buildProspectionEmail(selectedRecord)">Prévisualiser email</button>
          <div style="flex:1"></div>
          <button class="btn btn-outline" type="button" @click="selectedRecord = null">Fermer</button>
          <button class="btn btn-primary" type="submit">Enregistrer</button>
        </div>
      </form>
    </div>

    <div v-if="emailPreview" class="admin-side-panel">
      <form class="admin-form" @submit.prevent="sendCurrentEmail">
        <h2>Email à {{ selectedRecord?.municipality.nom }}</h2>
        <div class="form-group">
          <label>Destinataire</label>
          <input v-model="emailPreview.recipient_email" type="email">
        </div>
        <div class="form-group">
          <label>Objet</label>
          <input v-model="emailPreview.subject" type="text">
        </div>
        <div class="form-group">
          <label>Message</label>
          <textarea v-model="emailPreview.body" rows="10" />
        </div>
        <p class="technical-note">L’envoi passe par la fonction serveur Supabase <code>send-prospection-email</code>, branchée à Gmail.</p>
        <div class="form-actions">
          <button class="btn btn-outline" type="button" @click="emailPreview = null">Fermer</button>
          <button class="btn btn-primary" type="submit" :disabled="emailSending || !emailPreview.recipient_email">
            {{ emailSending ? 'Envoi...' : 'Envoyer avec Gmail' }}
          </button>
        </div>
      </form>
    </div>

    <div v-if="isLoading" class="empty-state compact-empty">
      <span class="empty-icon">🧭</span>
      <h3>Chargement des communes...</h3>
    </div>

    <div v-else-if="filteredRecords.length === 0" class="empty-state compact-empty">
      <span class="empty-icon">🧭</span>
      <h3>Aucune commune trouvée</h3>
      <p>Lancez une recherche ou modifiez vos filtres.</p>
    </div>

    <div v-else>
      <div class="prospection-count">{{ filteredRecords.length }} commune{{ filteredRecords.length > 1 ? 's' : '' }} affichée{{ filteredRecords.length > 1 ? 's' : '' }}</div>
      <div class="prospection-list">
        <article v-for="record in filteredRecords" :key="record.id" class="prospection-card">
          <div class="prospection-card-head">
            <div>
              <h3>
                {{ record.municipality.nom }}
                <span class="status-badge" :class="`status-prospect-${record.statut}`">
                  {{ prospectionStatusLabels[record.statut] }}
                </span>
              </h3>
              <div class="request-meta">
                {{ record.municipality.department_code }} · {{ record.municipality.population ?? '—' }} hab. · {{ commerceLabel(record) }} commerce(s) estimé(s)
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" type="button" @click="selectedRecord = { ...record }">Détails</button>
          </div>
          <div class="request-details">
            <div class="request-detail"><strong>Email :</strong> {{ record.enrichment.mairie_email || 'Email mairie manquant' }}</div>
            <div class="request-detail"><strong>Tél :</strong> {{ record.enrichment.mairie_phone || 'Téléphone manquant' }}</div>
            <div class="request-detail"><strong>Horaires :</strong> {{ record.enrichment.mairie_opening_hours || 'Non renseignés' }}</div>
            <div class="request-detail"><strong>Source commerces :</strong> {{ record.enrichment.commerce_source || 'OSM' }}</div>
          </div>
          <div class="prospection-card-actions">
            <select :value="record.statut" class="prospection-status-select" @change="setStatus(record, ($event.target as HTMLSelectElement).value as ProspectionStatus)">
              <option v-for="(label, value) in prospectionStatusLabels" :key="value" :value="value">{{ label }}</option>
            </select>
            <button class="btn btn-outline btn-sm" type="button" @click="selectedRecord = { ...record }">Modifier</button>
            <button class="btn btn-primary btn-sm" type="button" :disabled="!record.enrichment.mairie_email" @click="openEmail(record)">Prévisualiser email</button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
