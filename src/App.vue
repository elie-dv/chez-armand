<script setup lang="ts">
import { ref } from 'vue';
import PublicForm from './components/PublicForm.vue';
import { jeuneFormConfig, villageFormConfig } from './lib/config';
import type { FormConfig, JeuneFormData, VillageFormData } from './types/forms';

type ActiveSection = 'village' | 'jeune' | null;
type PublicFormData = Record<string, string | number | null>;

const activeSection = ref<ActiveSection>(null);
const year = new Date().getFullYear();

const villageInitialData: VillageFormData = {
  nom: null,
  code_postal: null,
  nombre_habitants: null,
  contact_nom: null,
  contact_email: null,
  contact_telephone: null,
  date_souhaitee: null,
  message: null,
};

const jeuneInitialData: JeuneFormData = {
  prenom: null,
  nom: null,
  age: null,
  email: null,
  telephone: null,
  motivation: null,
};

const publicVillageFormConfig = villageFormConfig as unknown as FormConfig<PublicFormData>;
const publicJeuneFormConfig = jeuneFormConfig as unknown as FormConfig<PublicFormData>;
const publicVillageInitialData = villageInitialData as unknown as PublicFormData;
const publicJeuneInitialData = jeuneInitialData as unknown as PublicFormData;

function toggleSection(section: Exclude<ActiveSection, null>) {
  activeSection.value = activeSection.value === section ? null : section;
}
</script>

<template>
  <header id="top" class="hero">
    <div class="hero-content">
      <h1 class="hero-title">Chez Armand</h1>
      <p class="hero-subtitle">On ramène la fête là où il n'y a plus de bistrot.</p>
      <p class="hero-description">
        Un vieux camion, des planches de charcuterie, des bières et du bon vin :
        on sillonne les villages de moins de 100 habitants pour créer des moments de convivialité.
      </p>
      <div class="hero-cta">
        <a href="#choices" class="btn btn-hero btn-village">Découvrir</a>
      </div>
    </div>
  </header>

  <section class="section about" id="about">
    <div class="container">
      <h2 class="section-title">Qui sommes-nous ?</h2>
      <div class="features">
        <div class="feature">
          <span class="feature-icon" role="img" aria-label="Camion">🚚</span>
          <h3>Le Camion</h3>
          <p>Un vieux camion aménagé qui parcourt les routes de campagne tout l'été, de village en village.</p>
        </div>
        <div class="feature">
          <span class="feature-icon" role="img" aria-label="Poignée de main">🤝</span>
          <h3>Le Lien Social</h3>
          <p>Redonner vie aux places de village en créant des moments de partage entre habitants, jeunes et anciens.</p>
        </div>
        <div class="feature">
          <span class="feature-icon" role="img" aria-label="Fête">🎉</span>
          <h3>La Fête</h3>
          <p>Charcuterie, bières locales, bons vins et bonne humeur : les ingrédients d'une soirée réussie.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section choices" id="choices">
    <div class="container">
      <h2 class="section-title">Comment participer ?</h2>
      <div class="cards">
        <a
          href="#village-section"
          class="card card-village"
          :class="{ 'card--active': activeSection === 'village' }"
          :aria-expanded="activeSection === 'village'"
          aria-controls="village-section"
          @click.prevent="toggleSection('village')"
        >
          <span class="card-icon" role="img" aria-label="Village">🏘️</span>
          <h3>Vous êtes un village ?</h3>
          <p>Inscrivez votre commune pour accueillir Chez Armand cet été et offrir un moment de convivialité à vos habitants.</p>
          <span class="card-btn">Inscrire mon village</span>
        </a>
        <a
          href="#jeune-section"
          class="card card-jeune"
          :class="{ 'card--active': activeSection === 'jeune' }"
          :aria-expanded="activeSection === 'jeune'"
          aria-controls="jeune-section"
          @click.prevent="toggleSection('jeune')"
        >
          <span class="card-icon" role="img" aria-label="Personne qui lève la main">🙋</span>
          <h3>Vous êtes un jeune ?</h3>
          <p>Rejoignez l'équipe pour organiser 3 à 4 fêtes de village cet été. Une aventure humaine unique !</p>
          <span class="card-btn">Rejoindre l'équipe</span>
        </a>
      </div>
    </div>
  </section>

  <main class="main-content">
    <section
      id="village-section"
      class="section"
      :class="{ visible: activeSection === 'village' }"
      :aria-hidden="activeSection !== 'village'"
    >
      <div class="container">
        <h2 class="section-title">Inscrire mon village</h2>
        <p class="section-description">
          Remplissez ce formulaire et on vous recontacte pour organiser la soirée.
        </p>
        <PublicForm :config="publicVillageFormConfig" :initial-data="publicVillageInitialData" kind="village" />
        <div class="back-top"><a href="#top">Retour en haut</a></div>
      </div>
    </section>

    <section
      id="jeune-section"
      class="section section-alt"
      :class="{ visible: activeSection === 'jeune' }"
      :aria-hidden="activeSection !== 'jeune'"
    >
      <div class="container">
        <h2 class="section-title">Rejoindre l'équipe</h2>
        <p class="section-description">
          Tu as entre 16 et 35 ans et envie d'une expérience enrichissante ? Postule ici !
        </p>
        <PublicForm :config="publicJeuneFormConfig" :initial-data="publicJeuneInitialData" kind="jeune" />
        <div class="back-top"><a href="#top">Retour en haut</a></div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="container">
      <p class="footer-brand">Chez Armand</p>
      <p>&copy; {{ year }} Chez Armand. Tous droits réservés.</p>
      <p>Association créant du lien social dans les villages français</p>
    </div>
  </footer>
</template>
