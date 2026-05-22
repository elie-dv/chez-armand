<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  error: string;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  submit: [email: string, password: string];
}>();

const email = ref('');
const password = ref('');

function submit() {
  emit('submit', email.value, password.value);
}
</script>

<template>
  <div id="login-screen">
    <div class="login-card">
      <div class="login-brand">🚚</div>
      <h1>Chez Armand</h1>
      <p class="login-subtitle">Back-office</p>

      <form @submit.prevent="submit">
        <div class="login-field">
          <label for="login-email">Email</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
          >
        </div>
        <div class="login-field">
          <label for="login-password">Mot de passe</label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
          >
        </div>

        <button type="submit" class="btn btn-primary btn-full" :disabled="isLoading">
          {{ isLoading ? 'Connexion...' : 'Connexion' }}
        </button>
        <div class="login-error" role="alert">{{ error }}</div>
      </form>
    </div>
  </div>
</template>
