<script setup lang="ts">
import { computed, ref } from 'vue';

defineProps<{
  error: string;
  isLoading: boolean;
  userEmail: string;
}>();

const emit = defineEmits<{
  submit: [password: string];
}>();

const password = ref('');
const confirmation = ref('');
const localError = ref('');

const canSubmit = computed(() => password.value.length >= 8 && password.value === confirmation.value);

function submit() {
  localError.value = '';
  if (password.value.length < 8) {
    localError.value = 'Le mot de passe doit contenir au moins 8 caractères.';
    return;
  }
  if (password.value !== confirmation.value) {
    localError.value = 'Les deux mots de passe ne correspondent pas.';
    return;
  }
  emit('submit', password.value);
}
</script>

<template>
  <div id="login-screen">
    <div class="login-card">
      <div class="login-brand">🚚</div>
      <h1>Nouveau mot de passe</h1>
      <p class="login-subtitle">{{ userEmail }}</p>

      <form @submit.prevent="submit">
        <div class="login-field">
          <label for="new-password">Nouveau mot de passe</label>
          <input
            id="new-password"
            v-model="password"
            type="password"
            required
            autocomplete="new-password"
          >
        </div>
        <div class="login-field">
          <label for="new-password-confirmation">Confirmation</label>
          <input
            id="new-password-confirmation"
            v-model="confirmation"
            type="password"
            required
            autocomplete="new-password"
          >
        </div>

        <button type="submit" class="btn btn-primary btn-full" :disabled="isLoading || !canSubmit">
          {{ isLoading ? 'Mise à jour...' : 'Changer le mot de passe' }}
        </button>
        <div class="login-error" role="alert">{{ localError || error }}</div>
      </form>
    </div>
  </div>
</template>
