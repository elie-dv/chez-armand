<script setup lang="ts">
import type { AdminBadges, AdminNavItem, AdminViewId } from '../types';

defineProps<{
  activeView: AdminViewId;
  badges: AdminBadges;
  items: AdminNavItem[];
  userEmail: string;
}>();

const emit = defineEmits<{
  logout: [];
  navigate: [view: AdminViewId];
}>();

function badgeFor(itemId: AdminViewId, badges: AdminBadges) {
  if (itemId === 'villages') return badges.villages;
  if (itemId === 'prospection') return badges.prospection;
  if (itemId === 'jeunes') return badges.jeunes;
  if (itemId === 'messagerie') return badges.messagerie;
  return 0;
}
</script>

<template>
  <div id="admin-app">
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="sidebar-brand-icon">🚚</span>
        <span class="sidebar-brand-text">Chez Armand</span>
      </div>

      <nav class="sidebar-nav">
        <a
          v-for="item in items"
          :key="item.id"
          href="#"
          class="nav-item"
          :class="{ active: activeView === item.id }"
          @click.prevent="emit('navigate', item.id)"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
          <span
            v-if="badgeFor(item.id, badges) > 0"
            class="nav-badge visible"
          >
            {{ badgeFor(item.id, badges) }}
          </span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user">{{ userEmail }}</div>
        <button class="btn-logout" type="button" @click="emit('logout')">Déconnexion</button>
      </div>
    </aside>

    <main class="admin-main">
      <slot />
    </main>
  </div>
</template>
