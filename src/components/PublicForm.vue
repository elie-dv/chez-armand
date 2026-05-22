<script setup lang="ts">
import type { FormConfig } from '../types/forms';
import { usePublicForm } from '../composables/usePublicForm';

type PublicFormData = Record<string, string | number | null>;

const props = defineProps<{
  config: FormConfig<PublicFormData>;
  initialData: PublicFormData;
  kind: 'village' | 'jeune';
}>();

const { data, errorsByField, message, status, submit, validateField } = usePublicForm(
  props.initialData,
  props.config,
);

const isLoading = () => status.value === 'loading';
</script>

<template>
  <form class="form" novalidate @submit.prevent="submit">
    <template v-if="kind === 'village'">
      <div class="form-group" :class="{ 'has-error': errorsByField.nom }">
        <label for="village-nom">Nom du village *</label>
        <input
          id="village-nom"
          v-model="data.nom"
          type="text"
          name="nom"
          required
          @blur="validateField('nom')"
        >
        <span v-if="errorsByField.nom" class="field-error" role="alert">{{ errorsByField.nom }}</span>
      </div>

      <div class="form-row">
        <div class="form-group" :class="{ 'has-error': errorsByField.code_postal }">
          <label for="village-code-postal">Code postal *</label>
          <input
            id="village-code-postal"
            v-model="data.code_postal"
            type="text"
            name="code_postal"
            required
            pattern="[0-9]{5}"
            @blur="validateField('code_postal')"
          >
          <span v-if="errorsByField.code_postal" class="field-error" role="alert">{{ errorsByField.code_postal }}</span>
        </div>
        <div class="form-group" :class="{ 'has-error': errorsByField.nombre_habitants }">
          <label for="village-habitants">Nombre d'habitants *</label>
          <input
            id="village-habitants"
            v-model.number="data.nombre_habitants"
            type="number"
            name="nombre_habitants"
            required
            min="1"
            max="100"
            @blur="validateField('nombre_habitants')"
          >
          <span v-if="errorsByField.nombre_habitants" class="field-error" role="alert">{{ errorsByField.nombre_habitants }}</span>
        </div>
      </div>

      <div class="form-group" :class="{ 'has-error': errorsByField.contact_nom }">
        <label for="village-contact-nom">Nom du contact *</label>
        <input
          id="village-contact-nom"
          v-model="data.contact_nom"
          type="text"
          name="contact_nom"
          required
          @blur="validateField('contact_nom')"
        >
        <span v-if="errorsByField.contact_nom" class="field-error" role="alert">{{ errorsByField.contact_nom }}</span>
      </div>

      <div class="form-row">
        <div class="form-group" :class="{ 'has-error': errorsByField.contact_email }">
          <label for="village-contact-email">Email *</label>
          <input
            id="village-contact-email"
            v-model="data.contact_email"
            type="email"
            name="contact_email"
            required
            @blur="validateField('contact_email')"
          >
          <span v-if="errorsByField.contact_email" class="field-error" role="alert">{{ errorsByField.contact_email }}</span>
        </div>
        <div class="form-group" :class="{ 'has-error': errorsByField.contact_telephone }">
          <label for="village-contact-telephone">Téléphone *</label>
          <input
            id="village-contact-telephone"
            v-model="data.contact_telephone"
            type="tel"
            name="contact_telephone"
            required
            @blur="validateField('contact_telephone')"
          >
          <span v-if="errorsByField.contact_telephone" class="field-error" role="alert">{{ errorsByField.contact_telephone }}</span>
        </div>
      </div>

      <div class="form-group">
        <label for="village-date">Date souhaitée (optionnel)</label>
        <input id="village-date" v-model="data.date_souhaitee" type="date" name="date_souhaitee">
      </div>

      <div class="form-group">
        <label for="village-message-text">Message (optionnel)</label>
        <textarea id="village-message-text" v-model="data.message" name="message" rows="4" />
      </div>
    </template>

    <template v-else>
      <div class="form-row">
        <div class="form-group" :class="{ 'has-error': errorsByField.prenom }">
          <label for="jeune-prenom">Prénom *</label>
          <input
            id="jeune-prenom"
            v-model="data.prenom"
            type="text"
            name="prenom"
            required
            @blur="validateField('prenom')"
          >
          <span v-if="errorsByField.prenom" class="field-error" role="alert">{{ errorsByField.prenom }}</span>
        </div>
        <div class="form-group" :class="{ 'has-error': errorsByField.nom }">
          <label for="jeune-nom">Nom *</label>
          <input id="jeune-nom" v-model="data.nom" type="text" name="nom" required @blur="validateField('nom')">
          <span v-if="errorsByField.nom" class="field-error" role="alert">{{ errorsByField.nom }}</span>
        </div>
      </div>

      <div class="form-group" :class="{ 'has-error': errorsByField.age }">
        <label for="jeune-age">Âge *</label>
        <input
          id="jeune-age"
          v-model.number="data.age"
          type="number"
          name="age"
          required
          min="16"
          max="35"
          @blur="validateField('age')"
        >
        <span v-if="errorsByField.age" class="field-error" role="alert">{{ errorsByField.age }}</span>
      </div>

      <div class="form-row">
        <div class="form-group" :class="{ 'has-error': errorsByField.email }">
          <label for="jeune-email">Email *</label>
          <input id="jeune-email" v-model="data.email" type="email" name="email" required @blur="validateField('email')">
          <span v-if="errorsByField.email" class="field-error" role="alert">{{ errorsByField.email }}</span>
        </div>
        <div class="form-group" :class="{ 'has-error': errorsByField.telephone }">
          <label for="jeune-telephone">Téléphone *</label>
          <input
            id="jeune-telephone"
            v-model="data.telephone"
            type="tel"
            name="telephone"
            required
            @blur="validateField('telephone')"
          >
          <span v-if="errorsByField.telephone" class="field-error" role="alert">{{ errorsByField.telephone }}</span>
        </div>
      </div>

      <div class="form-group" :class="{ 'has-error': errorsByField.motivation }">
        <label for="jeune-motivation">Motivation *</label>
        <textarea
          id="jeune-motivation"
          v-model="data.motivation"
          name="motivation"
          rows="4"
          required
          placeholder="Pourquoi souhaitez-vous rejoindre Chez Armand ?"
          @blur="validateField('motivation')"
        />
        <span v-if="errorsByField.motivation" class="field-error" role="alert">{{ errorsByField.motivation }}</span>
      </div>
    </template>

    <button type="submit" class="btn btn-primary" :class="{ 'btn-loading': isLoading() }" :disabled="isLoading()">
      {{ isLoading() ? '' : config.submitLabel }}
    </button>
    <div
      v-if="message"
      class="form-message"
      :class="status"
      role="status"
      aria-live="polite"
    >
      {{ message }}
    </div>
  </form>
</template>
