import { computed, ref } from 'vue';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';

export function useAdminAuth() {
  const client = getSupabaseClient();
  const user = ref<User | null>(null);
  const isCheckingSession = ref(true);
  const isLoggingIn = ref(false);
  const isUpdatingPassword = ref(false);
  const isRecoveryMode = ref(false);
  const authError = ref(client ? '' : 'Configuration Supabase manquante.');

  const isAuthenticated = computed(() => !!user.value);

  async function checkSession() {
    isCheckingSession.value = true;
    authError.value = client ? '' : 'Configuration Supabase manquante.';

    if (!client) {
      isCheckingSession.value = false;
      return;
    }

    const { data, error } = await client.auth.getSession();
    if (error) authError.value = 'Impossible de vérifier la session.';
    user.value = data.session?.user || null;
    isRecoveryMode.value = window.location.hash.includes('type=recovery') && !!data.session?.user;
    isCheckingSession.value = false;
  }

  async function login(email: string, password: string) {
    if (!client) {
      authError.value = 'Configuration Supabase manquante.';
      return false;
    }

    isLoggingIn.value = true;
    authError.value = '';

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    isLoggingIn.value = false;

    if (error) {
      authError.value = 'Email ou mot de passe incorrect.';
      return false;
    }

    user.value = data.user;
    return true;
  }

  async function logout() {
    if (client) await client.auth.signOut();
    user.value = null;
    isRecoveryMode.value = false;
  }

  async function updatePassword(password: string) {
    if (!client) {
      authError.value = 'Configuration Supabase manquante.';
      return false;
    }

    isUpdatingPassword.value = true;
    authError.value = '';
    const { data, error } = await client.auth.updateUser({ password });
    isUpdatingPassword.value = false;

    if (error) {
      authError.value = 'Impossible de mettre à jour le mot de passe.';
      return false;
    }

    user.value = data.user;
    isRecoveryMode.value = false;
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  }

  return {
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
  };
}
