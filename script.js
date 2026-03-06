// Supabase configuration
// Replace these with your actual Supabase project URL and anon key
const SUPABASE_URL = 'https://qlgftfpdaawujzxdnjzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZ2Z0ZnBkYWF3dWp6eGRuanpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1OTgzNjQsImV4cCI6MjA4MDE3NDM2NH0.dx984AJf3mbreiH1Ob0t45lClsfguLeqMmprKd2N4o4'; // Replace with your actual anon key

// Initialize Supabase client
// The supabase library is loaded via CDN before this script
let supabaseClient;
try {
    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded. Make sure the CDN script is included before this script.');
    } else {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized successfully');
    }
} catch (error) {
    console.error('Error initializing Supabase client:', error);
}

// Utility functions
function showMessage(formId, message, type) {
    const messageEl = document.getElementById(`${formId}-message`);
    if (messageEl) {
        messageEl.textContent = message;
        messageEl.className = `form-message ${type}`;
        messageEl.style.display = 'block';
        
        // Scroll to message
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Hide success message after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 5000);
        }
    }
}

function resetForm(formId) {
    const form = document.getElementById(`${formId}-form`);
    if (form) {
        form.reset();
    }
}

function setFormLoading(formId, isLoading) {
    const form = document.getElementById(`${formId}-form`);
    const submitBtn = form?.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = isLoading;
        if (isLoading) {
            submitBtn.textContent = 'Envoi en cours...';
        } else {
            submitBtn.textContent = formId === 'village' ? 'Envoyer la demande' : 'Postuler';
        }
    }
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    initializeForms();
});

function initializeForms() {
    // Village form handler
    const villageForm = document.getElementById('village-form');
    if (!villageForm) {
        console.error('Village form not found');
        return;
    }
    
    villageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Get form values
    const villageData = {
        nom: formData.get('nom').trim(),
        code_postal: formData.get('code_postal').trim(),
        nombre_habitants: parseInt(formData.get('nombre_habitants')),
        contact_nom: formData.get('contact_nom').trim(),
        contact_email: formData.get('contact_email').trim(),
        contact_telephone: formData.get('contact_telephone').trim(),
        date_souhaitee: formData.get('date_souhaitee') || null,
        message: formData.get('message')?.trim() || null
    };
    
    // Validation
    if (!villageData.nom || !villageData.code_postal || !villageData.nombre_habitants || 
        !villageData.contact_nom || !villageData.contact_email || !villageData.contact_telephone) {
        showMessage('village', 'Veuillez remplir tous les champs obligatoires.', 'error');
        return;
    }
    
    if (villageData.nombre_habitants > 100) {
        showMessage('village', 'Le village doit avoir moins de 100 habitants.', 'error');
        return;
    }
    
    if (!/^[0-9]{5}$/.test(villageData.code_postal)) {
        showMessage('village', 'Le code postal doit contenir 5 chiffres.', 'error');
        return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(villageData.contact_email)) {
        showMessage('village', 'Veuillez entrer une adresse email valide.', 'error');
        return;
    }
    
    // Check if Supabase client is initialized
    if (!supabaseClient) {
        showMessage('village', 'Erreur de configuration. Veuillez recharger la page.', 'error');
        return;
    }
    
    // Submit to Supabase
    setFormLoading('village', true);
    showMessage('village', 'Envoi en cours...', 'loading');
    
    try {
        console.log('Submitting village data:', villageData);
        const { data, error } = await supabaseClient
            .from('villages')
            .insert([villageData])
            .select();
        
        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        console.log('Success! Data inserted:', data);
        showMessage('village', 'Merci ! Votre demande a été envoyée avec succès. Nous vous contacterons bientôt.', 'success');
        resetForm('village');
        
        // Reset form after success message
        setTimeout(() => {
            resetForm('village');
        }, 100);
        
    } catch (error) {
        console.error('Error submitting village form:', error);
        const errorMessage = error.message || error.code || 'Erreur inconnue';
        showMessage('village', `Une erreur est survenue: ${errorMessage}. Vérifiez la console pour plus de détails.`, 'error');
    } finally {
        setFormLoading('village', false);
    }
    });
    
    // Jeune form handler
    const jeuneForm = document.getElementById('jeune-form');
    if (!jeuneForm) {
        console.error('Jeune form not found');
        return;
    }
    
    jeuneForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Get form values
    const jeuneData = {
        prenom: formData.get('prenom').trim(),
        nom: formData.get('nom').trim(),
        age: parseInt(formData.get('age')),
        email: formData.get('email').trim(),
        telephone: formData.get('telephone').trim(),
        motivation: formData.get('motivation').trim()
    };
    
    // Validation
    if (!jeuneData.prenom || !jeuneData.nom || !jeuneData.age || 
        !jeuneData.email || !jeuneData.telephone || !jeuneData.motivation) {
        showMessage('jeune', 'Veuillez remplir tous les champs obligatoires.', 'error');
        return;
    }
    
    if (jeuneData.age < 16 || jeuneData.age > 35) {
        showMessage('jeune', 'L\'âge doit être entre 16 et 35 ans.', 'error');
        return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(jeuneData.email)) {
        showMessage('jeune', 'Veuillez entrer une adresse email valide.', 'error');
        return;
    }
    
    if (jeuneData.motivation.length < 20) {
        showMessage('jeune', 'Veuillez développer votre motivation (au moins 20 caractères).', 'error');
        return;
    }
    
    // Check if Supabase client is initialized
    if (!supabaseClient) {
        showMessage('jeune', 'Erreur de configuration. Veuillez recharger la page.', 'error');
        return;
    }
    
    // Submit to Supabase
    setFormLoading('jeune', true);
    showMessage('jeune', 'Envoi en cours...', 'loading');
    
    try {
        console.log('Submitting jeune data:', jeuneData);
        const { data, error } = await supabaseClient
            .from('jeunes')
            .insert([jeuneData])
            .select();
        
        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        console.log('Success! Data inserted:', data);
        showMessage('jeune', 'Merci ! Votre candidature a été envoyée avec succès. Nous vous contacterons bientôt.', 'success');
        resetForm('jeune');
        
        // Reset form after success message
        setTimeout(() => {
            resetForm('jeune');
        }, 100);
        
    } catch (error) {
        console.error('Error submitting jeune form:', error);
        const errorMessage = error.message || error.code || 'Erreur inconnue';
        showMessage('jeune', `Une erreur est survenue: ${errorMessage}. Vérifiez la console pour plus de détails.`, 'error');
    } finally {
        setFormLoading('jeune', false);
    }
    });
    
        // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}
