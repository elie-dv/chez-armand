<script setup lang="ts">
import type { AppSupabaseClient } from '../../types/database';
import { computed, onMounted, ref } from 'vue';
import { loadJeunes, type Jeune } from '../jeunes';
import {
  buildContacts,
  formatMsgDate,
  formatMsgTime,
  loadConversation,
  loadLastMessages,
  loadUnreadCounts,
  markMessagesAsRead,
  sendMessage,
  type Message,
} from '../messagerie';

const props = defineProps<{
  client: AppSupabaseClient;
}>();

const emit = defineEmits<{
  refreshBadges: [];
}>();

const jeunes = ref<Jeune[]>([]);
const contacts = ref<Jeune[]>([]);
const lastMsgMap = ref<Record<string, Message>>({});
const unreadCounts = ref<Record<string, number>>({});
const selectedJeuneId = ref<string | null>(null);
const messages = ref<Message[]>([]);
const search = ref('');
const draft = ref('');
const error = ref('');
const isLoading = ref(true);
const isSending = ref(false);

const selectedJeune = computed(() => jeunes.value.find((jeune) => jeune.id === selectedJeuneId.value) || null);
const filteredContacts = computed(() => {
  const term = search.value.toLowerCase().trim();
  if (!term) return contacts.value;
  return contacts.value.filter((jeune) => `${jeune.prenom} ${jeune.nom}`.toLowerCase().includes(term));
});

async function refresh() {
  isLoading.value = true;
  error.value = '';

  try {
    const [nextJeunes, nextMessages, nextUnread] = await Promise.all([
      loadJeunes(props.client),
      loadLastMessages(props.client),
      loadUnreadCounts(props.client),
    ]);
    jeunes.value = nextJeunes;
    unreadCounts.value = nextUnread;
    const built = buildContacts(nextJeunes, nextMessages);
    contacts.value = built.contacts;
    lastMsgMap.value = built.lastMsgMap;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de charger la messagerie.';
  } finally {
    isLoading.value = false;
  }
}

async function selectConversation(jeuneId: string) {
  selectedJeuneId.value = jeuneId;
  error.value = '';

  try {
    messages.value = await loadConversation(props.client, jeuneId);
    await markMessagesAsRead(props.client, jeuneId);
    delete unreadCounts.value[jeuneId];
    emit('refreshBadges');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de charger la conversation.';
  }
}

async function submitMessage() {
  if (!selectedJeuneId.value || !draft.value.trim()) return;
  isSending.value = true;
  error.value = '';

  try {
    await sendMessage(props.client, selectedJeuneId.value, draft.value);
    draft.value = '';
    messages.value = await loadConversation(props.client, selectedJeuneId.value);
    await refresh();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible d’envoyer le message.';
  } finally {
    isSending.value = false;
  }
}

function initials(jeune: Jeune) {
  return `${jeune.prenom?.[0] || ''}${jeune.nom?.[0] || ''}`.toUpperCase();
}

function previewFor(jeune: Jeune) {
  const message = lastMsgMap.value[jeune.id];
  if (!message) return 'Aucun message';
  const prefix = message.expediteur === 'admin' ? 'Vous : ' : '';
  return `${prefix}${message.contenu}`.slice(0, 48);
}

onMounted(refresh);
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h1>Messagerie</h1>
      <div class="view-actions">
        <button class="btn btn-outline" type="button" :disabled="isLoading" @click="refresh">Actualiser</button>
      </div>
    </div>

    <div v-if="error" class="admin-inline-error" role="alert">{{ error }}</div>

    <div class="msg-layout">
      <div class="msg-contacts">
        <div class="msg-contacts-header">
          <input v-model="search" type="text" placeholder="Rechercher un jeune..." class="msg-search-input">
        </div>
        <div class="msg-contacts-list">
          <div v-if="isLoading" class="msg-contacts-empty">Chargement...</div>
          <div v-else-if="filteredContacts.length === 0" class="msg-contacts-empty">Aucun contact trouvé</div>
          <button
            v-for="jeune in filteredContacts"
            v-else
            :key="jeune.id"
            class="msg-contact"
            :class="{ active: jeune.id === selectedJeuneId }"
            type="button"
            @click="selectConversation(jeune.id)"
          >
            <div class="msg-contact-avatar">{{ initials(jeune) }}</div>
            <div class="msg-contact-info">
              <div class="msg-contact-name">{{ jeune.prenom }} {{ jeune.nom }}</div>
              <div class="msg-contact-preview">{{ previewFor(jeune) }}</div>
            </div>
            <div class="msg-contact-meta">
              <span v-if="lastMsgMap[jeune.id]" class="msg-contact-time">
                {{ formatMsgTime(lastMsgMap[jeune.id].created_at) }}
              </span>
              <span v-if="unreadCounts[jeune.id]" class="msg-unread-dot" />
            </div>
          </button>
        </div>
      </div>

      <div class="msg-chat">
        <div v-if="!selectedJeune" class="msg-chat-empty">
          <span class="empty-icon">💬</span>
          <h3>Sélectionnez une conversation</h3>
          <p>Choisissez un jeune dans la liste pour commencer à discuter.</p>
        </div>

        <div v-else class="msg-chat-active">
          <div class="msg-chat-header">
            <div class="msg-contact-avatar" style="width:36px;height:36px;font-size:0.8rem">
              {{ initials(selectedJeune) }}
            </div>
            <div>
              <div class="msg-chat-header-name">{{ selectedJeune.prenom }} {{ selectedJeune.nom }}</div>
              <div class="msg-chat-header-status">{{ selectedJeune.age }} ans · {{ selectedJeune.email }}</div>
            </div>
          </div>

          <div class="msg-chat-messages">
            <div v-if="messages.length === 0" class="msg-contacts-empty" style="margin:auto">
              Aucun message pour l'instant. Envoyez le premier !
            </div>
            <template v-else>
              <template v-for="(message, index) in messages" :key="message.id">
                <div
                  v-if="index === 0 || formatMsgDate(messages[index - 1].created_at) !== formatMsgDate(message.created_at)"
                  class="msg-date-separator"
                >
                  {{ formatMsgDate(message.created_at) }}
                </div>
                <div
                  class="msg-bubble"
                  :class="message.expediteur === 'admin' ? 'msg-bubble-admin' : 'msg-bubble-jeune'"
                >
                  {{ message.contenu }}
                  <span class="msg-bubble-time">{{ formatMsgTime(message.created_at) }}</span>
                </div>
              </template>
            </template>
          </div>

          <div class="msg-chat-input">
            <form @submit.prevent="submitMessage">
              <div class="msg-input-row">
                <textarea
                  v-model="draft"
                  placeholder="Écrire un message..."
                  rows="1"
                  @keydown.enter.exact.prevent="submitMessage"
                />
                <button type="submit" class="btn btn-primary msg-send-btn" :disabled="isSending || !draft.trim()">
                  ↑
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
