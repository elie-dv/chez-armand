// ==================== CONFIGURATION ====================
const CONFIG = {
    supabase: {
        url: 'https://qlgftfpdaawujzxdnjzf.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZ2Z0ZnBkYWF3dWp6eGRuanpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1OTgzNjQsImV4cCI6MjA4MDE3NDM2NH0.dx984AJf3mbreiH1Ob0t45lClsfguLeqMmprKd2N4o4',
    },

    forms: {
        village: {
            table: 'villages',
            submitLabel: 'Envoyer la demande',
            successMessage: 'Merci ! Votre demande a été envoyée avec succès. Nous vous contacterons bientôt. 🎉',
            fields: {
                nom:                { required: true, label: 'Nom du village' },
                code_postal:        { required: true, label: 'Code postal',        pattern: /^[0-9]{5}$/, patternMsg: 'Le code postal doit contenir 5 chiffres.' },
                nombre_habitants:   { required: true, label: "Nombre d'habitants", type: 'int', min: 1, max: 100, maxMsg: 'Le village doit avoir moins de 100 habitants.' },
                contact_nom:        { required: true, label: 'Nom du contact' },
                contact_email:      { required: true, label: 'Email',              pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: 'Veuillez entrer une adresse email valide.' },
                contact_telephone:  { required: true, label: 'Téléphone' },
                date_souhaitee:     { required: false },
                message:            { required: false },
            },
        },

        jeune: {
            table: 'jeunes',
            submitLabel: 'Postuler',
            successMessage: 'Merci ! Votre candidature a été envoyée avec succès. Nous vous contacterons bientôt. 🎉',
            fields: {
                prenom:     { required: true, label: 'Prénom' },
                nom:        { required: true, label: 'Nom' },
                age:        { required: true, label: 'Âge',        type: 'int', min: 16, max: 35, minMsg: "L'âge doit être entre 16 et 35 ans.", maxMsg: "L'âge doit être entre 16 et 35 ans." },
                email:      { required: true, label: 'Email',      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: 'Veuillez entrer une adresse email valide.' },
                telephone:  { required: true, label: 'Téléphone' },
                motivation: { required: true, label: 'Motivation', minLength: 20, minLengthMsg: 'Veuillez développer votre motivation (au moins 20 caractères).' },
            },
        },
    },

    messages: {
        requiredField: 'Ce champ est obligatoire.',
        genericError: 'Une erreur est survenue. Veuillez réessayer.',
        configError: 'Erreur de configuration. Veuillez recharger la page.',
        sending: 'Envoi en cours...',
    },
};

// ==================== SUPABASE ====================
let supabaseClient = null;

function initSupabase() {
    try {
        if (typeof supabase === 'undefined') {
            console.error('Supabase library not loaded.');
            return false;
        }
        supabaseClient = supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
        return true;
    } catch (err) {
        console.error('Supabase init error:', err);
        return false;
    }
}

// ==================== VALIDATION ====================

/**
 * Validates form data against field rules.
 * Returns an array of { field, message } for each error, or [] if valid.
 */
function validateForm(data, fieldRules) {
    const errors = [];

    for (const [field, rules] of Object.entries(fieldRules)) {
        const value = data[field];

        // Required check
        if (rules.required) {
            const isEmpty = value === null || value === undefined || String(value).trim() === '' || (rules.type === 'int' && isNaN(value));
            if (isEmpty) {
                errors.push({ field, message: CONFIG.messages.requiredField });
                continue; // skip further checks for this field
            }
        } else if (value === null || value === undefined || String(value).trim() === '') {
            continue; // optional + empty → skip
        }

        // Pattern check
        if (rules.pattern && !rules.pattern.test(String(value))) {
            errors.push({ field, message: rules.patternMsg || 'Format invalide.' });
            continue;
        }

        // Numeric checks
        if (rules.type === 'int') {
            const num = parseInt(value);
            if (rules.min !== undefined && num < rules.min) {
                errors.push({ field, message: rules.minMsg || `La valeur minimale est ${rules.min}.` });
                continue;
            }
            if (rules.max !== undefined && num > rules.max) {
                errors.push({ field, message: rules.maxMsg || `La valeur maximale est ${rules.max}.` });
                continue;
            }
        }

        // Min length
        if (rules.minLength && String(value).trim().length < rules.minLength) {
            errors.push({ field, message: rules.minLengthMsg || `Minimum ${rules.minLength} caractères.` });
        }
    }

    return errors;
}

// ==================== UI HELPERS ====================

function showMessage(formId, message, type) {
    const el = document.getElementById(`${formId}-message`);
    if (!el) return;

    el.textContent = message;
    el.className = `form-message ${type}`;
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (type === 'success') {
        setTimeout(() => { el.style.display = 'none'; }, 6000);
    }
}

function clearMessage(formId) {
    const el = document.getElementById(`${formId}-message`);
    if (el) {
        el.style.display = 'none';
        el.className = 'form-message';
        el.textContent = '';
    }
}

function showFieldErrors(form, errors) {
    clearFieldErrors(form);
    let firstErrorField = null;

    for (const { field, message } of errors) {
        // Find the input by name
        const input = form.querySelector(`[name="${field}"]`);
        if (!input) continue;

        const group = input.closest('.form-group');
        if (!group) continue;

        group.classList.add('has-error');

        const errorSpan = document.createElement('span');
        errorSpan.className = 'field-error';
        errorSpan.textContent = message;
        errorSpan.setAttribute('role', 'alert');
        group.appendChild(errorSpan);

        if (!firstErrorField) firstErrorField = input;
    }

    // Focus first error field
    if (firstErrorField) {
        firstErrorField.focus();
    }
}

function clearFieldErrors(form) {
    form.querySelectorAll('.form-group.has-error').forEach(g => g.classList.remove('has-error'));
    form.querySelectorAll('.field-error').forEach(el => el.remove());
}

function setFormLoading(formId, isLoading, config) {
    const form = document.getElementById(`${formId}-form`);
    const btn = form?.querySelector('button[type="submit"]');
    if (!btn) return;

    btn.disabled = isLoading;

    if (isLoading) {
        btn.classList.add('btn-loading');
        btn.setAttribute('aria-busy', 'true');
        btn.textContent = CONFIG.messages.sending;
    } else {
        btn.classList.remove('btn-loading');
        btn.removeAttribute('aria-busy');
        btn.textContent = config.submitLabel;
    }
}

function resetForm(formId) {
    const form = document.getElementById(`${formId}-form`);
    if (form) {
        form.reset();
        clearFieldErrors(form);
    }
}

// ==================== FORM HANDLER FACTORY ====================

function createFormHandler(formId, config) {
    const form = document.getElementById(`${formId}-form`);
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessage(formId);
        clearFieldErrors(form);

        const formData = new FormData(form);
        const data = {};

        // Build data object from config fields
        for (const [field, rules] of Object.entries(config.fields)) {
            let value = formData.get(field);
            if (value !== null) value = value.trim();

            if (rules.type === 'int' && value) {
                data[field] = parseInt(value);
            } else {
                data[field] = value || null;
            }
        }

        // Validate
        const errors = validateForm(data, config.fields);
        if (errors.length > 0) {
            showFieldErrors(form, errors);
            return;
        }

        // Check Supabase
        if (!supabaseClient) {
            showMessage(formId, CONFIG.messages.configError, 'error');
            return;
        }

        // Submit
        setFormLoading(formId, true, config);
        showMessage(formId, CONFIG.messages.sending, 'loading');

        try {
            const { error } = await supabaseClient
                .from(config.table)
                .insert([data]);

            if (error) throw error;

            showMessage(formId, config.successMessage, 'success');
            resetForm(formId);
        } catch (err) {
            console.error(`Form ${formId} error:`, err.code || err.message);
            showMessage(formId, CONFIG.messages.genericError, 'error');
        } finally {
            setFormLoading(formId, false, config);
        }
    });

    // Blur validation: validate individual fields on blur after first interaction
    const inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        let touched = false;

        input.addEventListener('blur', () => {
            if (!touched) return;

            const fieldName = input.name;
            const rules = config.fields[fieldName];
            if (!rules) return;

            const group = input.closest('.form-group');
            if (!group) return;

            // Clear existing error on this field
            group.classList.remove('has-error');
            const existingError = group.querySelector('.field-error');
            if (existingError) existingError.remove();

            // Validate this single field
            let value = input.value.trim();
            if (rules.type === 'int' && value) value = parseInt(value);

            const errors = validateForm({ [fieldName]: value || null }, { [fieldName]: rules });
            if (errors.length > 0) {
                group.classList.add('has-error');
                const errorSpan = document.createElement('span');
                errorSpan.className = 'field-error';
                errorSpan.textContent = errors[0].message;
                errorSpan.setAttribute('role', 'alert');
                group.appendChild(errorSpan);
            }
        });

        input.addEventListener('input', () => {
            touched = true;
            // Clear error on typing
            const group = input.closest('.form-group');
            if (group && group.classList.contains('has-error')) {
                group.classList.remove('has-error');
                const existingError = group.querySelector('.field-error');
                if (existingError) existingError.remove();
            }
        });
    });
}

// ==================== SECTION TOGGLING ====================

function initSectionToggling() {
    const formSections = document.querySelectorAll('.main-content .section');
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
        card.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            const target = document.querySelector(targetId);
            if (!target) return;

            const isAlreadyVisible = target.classList.contains('visible');

            // Hide all sections + reset ARIA
            formSections.forEach(s => {
                s.classList.remove('visible');
                s.setAttribute('aria-hidden', 'true');
            });

            // Reset all cards
            cards.forEach(c => {
                c.classList.remove('card--active');
                c.setAttribute('aria-expanded', 'false');
            });

            // If clicking the same card that was already open, just close
            if (isAlreadyVisible) return;

            // Show target section
            target.classList.add('visible');
            target.setAttribute('aria-hidden', 'false');

            // Mark this card as active
            this.classList.add('card--active');
            this.setAttribute('aria-expanded', 'true');

            // Smooth scroll to section
            setTimeout(() => {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 80);
        });
    });
}

// ==================== SMOOTH SCROLL ====================

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]:not(.card)').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// ==================== DYNAMIC YEAR ====================

function setFooterYear() {
    const el = document.getElementById('year');
    if (el) el.textContent = new Date().getFullYear();
}

// ==================== INIT ====================

function init() {
    initSupabase();
    createFormHandler('village', CONFIG.forms.village);
    createFormHandler('jeune', CONFIG.forms.jeune);
    initSectionToggling();
    initSmoothScroll();
    setFooterYear();
}

document.addEventListener('DOMContentLoaded', init);
