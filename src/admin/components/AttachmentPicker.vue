<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { AppSupabaseClient } from '../../types/database';
import {
  deleteProspectionAttachment,
  getProspectionAttachmentSignedUrl,
  listProspectionAttachments,
  uploadProspectionAttachment,
  type EmailAttachment,
  type ProspectionAttachmentFile,
} from '../prospection';

const props = defineProps<{
  client: AppSupabaseClient;
  modelValue: EmailAttachment[];
  open: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [EmailAttachment[]];
  close: [];
}>();

const files = ref<ProspectionAttachmentFile[]>([]);
const loading = ref(false);
const uploading = ref(false);
const error = ref('');
const thumbnails = ref<Record<string, string>>({});
const fileInput = ref<HTMLInputElement | null>(null);

const selectedPaths = computed(() => new Set(props.modelValue.map((a) => a.path)));

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) refresh();
  },
);

onMounted(() => {
  if (props.open) refresh();
});

async function refresh() {
  loading.value = true;
  error.value = '';
  try {
    files.value = await listProspectionAttachments(props.client);
    await loadThumbnails();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de lister les pièces jointes.';
  } finally {
    loading.value = false;
  }
}

async function loadThumbnails() {
  const next: Record<string, string> = {};
  await Promise.all(
    files.value
      .filter((file) => file.mime_type.startsWith('image/'))
      .map(async (file) => {
        try {
          next[file.path] = await getProspectionAttachmentSignedUrl(props.client, file.path, 600);
        } catch {
          // ignore thumbnail errors
        }
      }),
  );
  thumbnails.value = next;
}

function toggle(file: ProspectionAttachmentFile) {
  const exists = selectedPaths.value.has(file.path);
  if (exists) {
    emit(
      'update:modelValue',
      props.modelValue.filter((a) => a.path !== file.path),
    );
  } else {
    emit('update:modelValue', [
      ...props.modelValue,
      { name: file.name, path: file.path, mime_type: file.mime_type, size: file.size },
    ]);
  }
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading.value = true;
  error.value = '';
  try {
    const uploaded = await uploadProspectionAttachment(props.client, file);
    await refresh();
    emit('update:modelValue', [
      ...props.modelValue,
      { name: uploaded.name, path: uploaded.path, mime_type: uploaded.mime_type, size: uploaded.size },
    ]);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Échec de l’upload.';
  } finally {
    uploading.value = false;
    input.value = '';
  }
}

async function removeFile(file: ProspectionAttachmentFile) {
  if (!confirm(`Supprimer définitivement « ${file.name} » du stockage ?`)) return;
  try {
    await deleteProspectionAttachment(props.client, file.path);
    emit(
      'update:modelValue',
      props.modelValue.filter((a) => a.path !== file.path),
    );
    await refresh();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Suppression impossible.';
  }
}

function formatSize(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function fileIcon(mime: string) {
  if (mime === 'application/pdf') return '📄';
  if (mime.startsWith('image/')) return '🖼️';
  return '📎';
}
</script>

<template>
  <div v-if="open" class="attachment-picker-overlay" @click.self="emit('close')">
    <div class="attachment-picker">
      <header class="attachment-picker-head">
        <h3>Pièces jointes disponibles</h3>
        <button class="btn btn-ghost" type="button" @click="emit('close')">✕</button>
      </header>

      <div class="attachment-picker-actions">
        <button class="btn btn-outline" type="button" :disabled="uploading" @click="fileInput?.click()">
          {{ uploading ? 'Upload en cours…' : '➕ Ajouter un fichier' }}
        </button>
        <input
          ref="fileInput"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
          style="display:none"
          @change="onFileChange"
        >
        <button class="btn btn-ghost" type="button" :disabled="loading" @click="refresh">↻ Actualiser</button>
      </div>

      <p v-if="error" class="error-banner">{{ error }}</p>

      <div v-if="loading" class="attachment-empty">Chargement…</div>
      <div v-else-if="files.length === 0" class="attachment-empty">
        Aucune pièce jointe pour l'instant.<br>
        Ajoute un PDF ou une image pour commencer.
      </div>
      <ul v-else class="attachment-list">
        <li
          v-for="file in files"
          :key="file.path"
          class="attachment-item"
          :class="{ selected: selectedPaths.has(file.path) }"
        >
          <label class="attachment-item-main">
            <input type="checkbox" :checked="selectedPaths.has(file.path)" @change="toggle(file)">
            <span class="attachment-thumb">
              <img v-if="thumbnails[file.path]" :src="thumbnails[file.path]" alt="">
              <span v-else class="attachment-icon">{{ fileIcon(file.mime_type) }}</span>
            </span>
            <span class="attachment-info">
              <span class="attachment-name">{{ file.name }}</span>
              <span class="attachment-meta">{{ file.mime_type }} · {{ formatSize(file.size) }}</span>
            </span>
          </label>
          <button class="btn-icon-danger" type="button" title="Supprimer du stockage" @click="removeFile(file)">🗑</button>
        </li>
      </ul>

      <footer class="attachment-picker-footer">
        <span>{{ modelValue.length }} sélectionnée{{ modelValue.length > 1 ? 's' : '' }}</span>
        <button class="btn btn-primary" type="button" @click="emit('close')">Valider</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.attachment-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.attachment-picker {
  background: var(--surface, #fff);
  border-radius: 12px;
  width: min(600px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
}
.attachment-picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border, #e5e7eb);
}
.attachment-picker-head h3 {
  margin: 0;
  font-size: 1.05rem;
}
.attachment-picker-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border, #e5e7eb);
}
.attachment-empty {
  padding: 2rem 1.25rem;
  text-align: center;
  color: var(--muted, #6b7280);
}
.attachment-list {
  list-style: none;
  margin: 0;
  padding: 0.5rem;
  overflow-y: auto;
  flex: 1;
}
.attachment-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 8px;
  border: 1px solid transparent;
}
.attachment-item:hover {
  background: var(--hover, #f3f4f6);
}
.attachment-item.selected {
  background: rgba(34, 197, 94, 0.08);
  border-color: rgba(34, 197, 94, 0.5);
}
.attachment-item-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}
.attachment-thumb {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  background: var(--hover, #f3f4f6);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.attachment-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.attachment-icon {
  font-size: 1.5rem;
}
.attachment-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.attachment-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attachment-meta {
  font-size: 0.8rem;
  color: var(--muted, #6b7280);
}
.btn-icon-danger {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  opacity: 0.6;
}
.btn-icon-danger:hover {
  background: rgba(239, 68, 68, 0.1);
  opacity: 1;
}
.attachment-picker-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--border, #e5e7eb);
  color: var(--muted, #6b7280);
  font-size: 0.9rem;
}
.error-banner {
  margin: 0.5rem 1.25rem;
  padding: 0.5rem 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
  border-radius: 6px;
  font-size: 0.9rem;
}
</style>
