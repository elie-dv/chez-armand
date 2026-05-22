<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import AdminLogin from './components/AdminLogin.vue';
import AdminResetPassword from './components/AdminResetPassword.vue';
import AdminShell from './components/AdminShell.vue';
import AdminViewPlaceholder from './components/AdminViewPlaceholder.vue';
import JeunesView from './components/JeunesView.vue';
import MessagerieView from './components/MessagerieView.vue';
import PlanningView from './components/PlanningView.vue';
import ProspectionView from './components/ProspectionView.vue';
import VehiculesView from './components/VehiculesView.vue';
import VillagesView from './components/VillagesView.vue';
import { loadAdminBadges, loadAdminMetrics } from './data';
import { adminNavItems } from './nav';
import type { AdminBadges, AdminMetric, AdminViewId } from './types';
import { useAdminAuth } from './useAdminAuth';

const {
  authError,
  checkSession,
  client,
  isAuthenticated,
  isCheckingSession,
  isLoggingIn,
  isRecoveryMode,
  isUpdatingPassword,
  login,
  logout,
  updatePassword,
  user,
} = useAdminAuth();

const activeView = ref<AdminViewId>('planning');
const badges = ref<AdminBadges>({ villages: 0, prospection: 0, jeunes: 0, messagerie: 0 });
const metrics = ref<AdminMetric[]>([]);
const isLoadingData = ref(false);

const userEmail = computed(() => user.value?.email || '');

async function refreshAdminData() {
  if (!client || !isAuthenticated.value) return;

  isLoadingData.value = true;
  const [nextBadges, nextMetrics] = await Promise.all([
    loadAdminBadges(client),
    loadAdminMetrics(client),
  ]);
  badges.value = nextBadges;
  metrics.value = nextMetrics;
  isLoadingData.value = false;
}

watch(isAuthenticated, async (authenticated) => {
  if (authenticated) await refreshAdminData();
});

onMounted(async () => {
  await checkSession();
  if (isAuthenticated.value) await refreshAdminData();
});
</script>

<template>
  <div v-if="isCheckingSession" id="login-screen">
    <div class="login-card">
      <div class="login-brand">🚚</div>
      <h1>Chez Armand</h1>
      <p class="login-subtitle">Chargement du back-office...</p>
    </div>
  </div>

  <AdminLogin
    v-else-if="!isAuthenticated"
    :error="authError"
    :is-loading="isLoggingIn"
    @submit="login"
  />

  <AdminResetPassword
    v-else-if="isRecoveryMode"
    :error="authError"
    :is-loading="isUpdatingPassword"
    :user-email="userEmail"
    @submit="updatePassword"
  />

  <AdminShell
    v-else
    :active-view="activeView"
    :badges="badges"
    :items="adminNavItems"
    :user-email="userEmail"
    @logout="logout"
    @navigate="activeView = $event"
  >
    <PlanningView
      v-if="activeView === 'planning' && client"
      :client="client"
      @refresh-badges="refreshAdminData"
    />
    <VehiculesView
      v-else-if="activeView === 'vehicules' && client"
      :client="client"
      @refresh-badges="refreshAdminData"
    />
    <VillagesView
      v-else-if="activeView === 'villages' && client"
      :client="client"
      @refresh-badges="refreshAdminData"
    />
    <JeunesView
      v-else-if="activeView === 'jeunes' && client"
      :client="client"
      @refresh-badges="refreshAdminData"
    />
    <MessagerieView
      v-else-if="activeView === 'messagerie' && client"
      :client="client"
      @refresh-badges="refreshAdminData"
    />
    <ProspectionView
      v-else-if="activeView === 'prospection' && client"
      :client="client"
      @refresh-badges="refreshAdminData"
    />
    <AdminViewPlaceholder
      v-else
      :id="activeView"
      :is-loading="isLoadingData"
      :metrics="metrics"
    />
  </AdminShell>
</template>
