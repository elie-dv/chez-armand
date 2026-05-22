import type { FormConfig, JeuneFormData, VillageFormData } from '../types/forms';

export const appMessages = {
  requiredField: 'Ce champ est obligatoire.',
  genericError: 'Une erreur est survenue. Veuillez réessayer.',
  configError: 'Configuration Supabase manquante. Vérifiez les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.',
  sending: 'Envoi en cours...',
};

export const villageFormConfig: FormConfig<VillageFormData> = {
  table: 'villages',
  submitLabel: 'Envoyer la demande',
  successMessage: 'Merci ! Votre demande a été envoyée avec succès. Nous vous contacterons bientôt.',
  fields: {
    nom: { required: true, label: 'Nom du village' },
    code_postal: {
      required: true,
      label: 'Code postal',
      pattern: /^[0-9]{5}$/,
      patternMsg: 'Le code postal doit contenir 5 chiffres.',
    },
    nombre_habitants: {
      required: true,
      label: "Nombre d'habitants",
      type: 'int',
      min: 1,
      max: 100,
      maxMsg: 'Le village doit avoir moins de 100 habitants.',
    },
    contact_nom: { required: true, label: 'Nom du contact' },
    contact_email: {
      required: true,
      label: 'Email',
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      patternMsg: 'Veuillez entrer une adresse email valide.',
    },
    contact_telephone: { required: true, label: 'Téléphone' },
    date_souhaitee: { required: false },
    message: { required: false },
  },
};

export const jeuneFormConfig: FormConfig<JeuneFormData> = {
  table: 'jeunes',
  submitLabel: 'Postuler',
  successMessage: 'Merci ! Votre candidature a été envoyée avec succès. Nous vous contacterons bientôt.',
  fields: {
    prenom: { required: true, label: 'Prénom' },
    nom: { required: true, label: 'Nom' },
    age: {
      required: true,
      label: 'Âge',
      type: 'int',
      min: 16,
      max: 35,
      minMsg: "L'âge doit être entre 16 et 35 ans.",
      maxMsg: "L'âge doit être entre 16 et 35 ans.",
    },
    email: {
      required: true,
      label: 'Email',
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      patternMsg: 'Veuillez entrer une adresse email valide.',
    },
    telephone: { required: true, label: 'Téléphone' },
    motivation: {
      required: true,
      label: 'Motivation',
      minLength: 20,
      minLengthMsg: 'Veuillez développer votre motivation (au moins 20 caractères).',
    },
  },
};
