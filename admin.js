// ==================== CONFIGURATION ====================
const ADMIN_CONFIG = {
    supabase: {
        url: 'https://qlgftfpdaawujzxdnjzf.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZ2Z0ZnBkYWF3dWp6eGRuanpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1OTgzNjQsImV4cCI6MjA4MDE3NDM2NH0.dx984AJf3mbreiH1Ob0t45lClsfguLeqMmprKd2N4o4',
    },
    statutLabels: {
        nouveau: 'Nouveau',
        contacte: 'Contacté',
        accepte: 'Accepté',
        refuse: 'Refusé',
        planifie: 'Planifié',
        confirme: 'Confirmé',
        en_cours: 'En cours',
        termine: 'Terminé',
        annule: 'Annulé',
    },
    prospectionStatusLabels: {
        to_review: 'À qualifier',
        ready_to_contact: 'Prête',
        email_previewed: 'Email prévisualisé',
        email_sent: 'Email envoyé',
        to_call: 'À appeler',
        called: 'Appelée',
        follow_up_needed: 'Relance',
        replied: 'Réponse reçue',
        interested: 'Intéressée',
        not_interested: 'Pas intéressée',
        do_not_contact: 'Ne plus contacter',
    },
    prospectionStatusColors: {
        to_review: '#1565C0',
        ready_to_contact: '#6B3410',
        email_previewed: '#E65100',
        email_sent: '#2E7D32',
        to_call: '#8B4513',
        called: '#795548',
        follow_up_needed: '#C77800',
        replied: '#00838F',
        interested: '#2E7D32',
        not_interested: '#6B6560',
        do_not_contact: '#C62828',
    },
    initialProspectionArea: {
        nom: 'Bretagne initiale - 22/35/56',
        type: 'departments',
        config: {
            department_codes: ['22', '35', '56'],
            population_max: 500,
            commerce_max: 2,
            commerce_source: 'openstreetmap',
        },
    },
    prospectionEmail: {
        subject: 'Bar itinérant associatif – proposition de passage en août',
        body: `Bonjour,

Nous sommes un groupe de quatre amis de 25 ans réunis autour d'un projet associatif : nous avons rénové un vieux fourgon Citroën Type HY pour en faire un bar itinérant.

Après un gros succès l'année dernière dans la région du Lot (1 mois d'itinérance avec 15 fêtes au total), nous souhaiterions cette fois-ci aller dans le Morbihan et ses alentours du samedi 1er au samedi 8 août.

Pour ça, nous cherchons quelques communes intéressées pour accueillir, le temps d'une soirée, ce petit bar éphémère. Nous y proposerons à boire et à manger dans une ambiance détendue et festive. L'idée, c'est d'organiser quelque chose de très simple, le temps d'une soirée, la première semaine d'août.

Nous ne cherchons rien d'autre que de faire plaisir et d'animer les villages. Il ne s'agit pas d'un projet commercial : seulement l'envie de créer des moments partagés.

Ce que nous demandons : un peu de communication locale pour faire circuler l'info, et l'autorisation de servir des boissons.

Notre projet est directement visible sur Instagram ou sur Facebook sous le nom de Chez Armand.

[image à insérer]

Si cela vous intéresse, n'hésitez pas à me répondre ou à m'appeler directement au 0783775683.

Bien à vous,

--
Elie de Vismes`,
    },
    dayNames: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    dayNamesFull: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
    monthNames: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
};

// ==================== STATE ====================
const state = {
    user: null,
    currentView: 'planning',
    weekStart: getMonday(new Date()),
    vehicules: [],
    evenements: [],
    villages: [],
    jeunes: [],
    prospection: [],
    prospectionFilter: 'all',
    prospectionDeptFilter: 'all',
    prospectionSearch: '',
    prospectionMap: null,
    prospectionMarkers: [],
    prospectionDrawing: false,
    prospectionDraftPoints: [],
    prospectionDraftMarkers: [],
    prospectionDraftMidpoints: [],
    prospectionDraftPolygon: null,
    prospectionSelectedPoint: null,
    prospectionScanRunning: false,
    prospectionInfoSources: ['api-lannuaire', 'etablissements-publics'],
    villageFilter: 'all',
    jeuneFilter: 'all',
    msgSelectedJeuneId: null,
    msgMessages: [],
    msgUnreadCounts: {},
};

// ==================== SUPABASE ====================
let db = null;

function initSupabase() {
    if (typeof supabase === 'undefined') return false;
    db = supabase.createClient(ADMIN_CONFIG.supabase.url, ADMIN_CONFIG.supabase.anonKey);
    return true;
}

// ==================== UTILS ====================
function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
}

function addDays(d, n) {
    const date = new Date(d);
    date.setDate(date.getDate() + n);
    return date;
}

function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateFr(d) {
    return `${d.getDate()} ${ADMIN_CONFIG.monthNames[d.getMonth()]}`;
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
}

function isEventOnDay(evt, day) {
    const dayStr = formatDate(day);
    return evt.date_debut <= dayStr && evt.date_fin >= dayStr;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==================== AUTH ====================
async function checkSession() {
    if (!db) return;
    const { data: { session } } = await db.auth.getSession();
    if (session?.user) {
        state.user = session.user;
        showAdminApp();
    }
}

async function login(email, password) {
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');
    errorEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Connexion...';

    try {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        state.user = data.user;
        showAdminApp();
    } catch (err) {
        errorEl.textContent = 'Email ou mot de passe incorrect.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Connexion';
    }
}

async function logout() {
    await db.auth.signOut();
    state.user = null;
    document.getElementById('admin-app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}

function showAdminApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('admin-app').classList.remove('hidden');
    document.getElementById('sidebar-user').textContent = state.user?.email || '';
    loadAllData();
}

// ==================== DATA ====================
async function loadAllData() {
    await Promise.all([
        loadVehicules(),
        loadEvenements(),
        loadVillages(),
        loadJeunes(),
        loadProspection(),
    ]);
    await loadMsgUnreadCounts();
    renderCurrentView();
    updateBadges();
    updateMsgBadge();
}

async function loadVehicules() {
    const { data } = await db.from('vehicules').select('*').order('created_at');
    state.vehicules = data || [];
}

async function loadEvenements() {
    const start = formatDate(state.weekStart);
    const end = formatDate(addDays(state.weekStart, 6));
    const { data } = await db.from('evenements')
        .select('*')
        .lte('date_debut', end)
        .gte('date_fin', start)
        .order('date_debut');
    state.evenements = data || [];
}

async function loadAllEvenements() {
    const { data } = await db.from('evenements').select('*').order('date_debut');
    return data || [];
}

async function loadVillages() {
    const { data } = await db.from('villages').select('*').order('created_at', { ascending: false });
    state.villages = data || [];
}

async function loadJeunes() {
    const { data } = await db.from('jeunes').select('*').order('created_at', { ascending: false });
    state.jeunes = data || [];
}

async function loadProspection() {
    const { data: records, error } = await db
        .from('prospection_records')
        .select('*')
        .order('updated_at', { ascending: false });

    if (error) {
        console.warn('Prospection tables not ready:', error.message);
        state.prospection = [];
        state.prospectionError = error.message;
        return;
    }

    const municipalityIds = (records || []).map(r => r.municipality_id).filter(Boolean);
    if (municipalityIds.length === 0) {
        state.prospection = [];
        state.prospectionError = null;
        return;
    }

    const [{ data: municipalities }, { data: enrichments }] = await Promise.all([
        db.from('municipalities').select('*').in('id', municipalityIds),
        db.from('municipality_enrichments').select('*').in('municipality_id', municipalityIds),
    ]);

    const municipalitiesById = Object.fromEntries((municipalities || []).map(m => [m.id, m]));
    const enrichmentsById = Object.fromEntries((enrichments || []).map(e => [e.municipality_id, e]));

    state.prospection = (records || []).map(record => ({
        ...record,
        municipality: municipalitiesById[record.municipality_id],
        enrichment: enrichmentsById[record.municipality_id] || {},
    })).filter(item => item.municipality);
    state.prospectionError = null;
}

async function loadEquipeMembers(vehiculeId) {
    const { data } = await db
        .from('equipe_membres')
        .select('id, jeune_id, jeunes(id, prenom, nom)')
        .eq('vehicule_id', vehiculeId);
    return data || [];
}

function updateBadges() {
    const vBadge = document.getElementById('badge-villages');
    const jBadge = document.getElementById('badge-jeunes');
    const pBadge = document.getElementById('badge-prospection');
    const newVillages = state.villages.filter(v => v.statut === 'nouveau').length;
    const newJeunes = state.jeunes.filter(j => j.statut === 'nouveau').length;
    const toContact = state.prospection.filter(p => ['to_review', 'ready_to_contact', 'to_call', 'follow_up_needed'].includes(p.statut)).length;

    if (newVillages > 0) {
        vBadge.textContent = newVillages;
        vBadge.classList.add('visible');
    } else {
        vBadge.classList.remove('visible');
    }

    if (newJeunes > 0) {
        jBadge.textContent = newJeunes;
        jBadge.classList.add('visible');
    } else {
        jBadge.classList.remove('visible');
    }

    if (toContact > 0) {
        pBadge.textContent = toContact;
        pBadge.classList.add('visible');
    } else {
        pBadge.classList.remove('visible');
    }
}

// ==================== NAVIGATION ====================
function switchView(viewName) {
    state.currentView = viewName;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${viewName}`).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-view="${viewName}"]`)?.classList.add('active');
    renderCurrentView();
}

function renderCurrentView() {
    switch (state.currentView) {
        case 'planning': renderPlanning(); break;
        case 'vehicules': renderVehicules(); break;
        case 'villages': renderVillages(); break;
        case 'prospection': renderProspection(); break;
        case 'jeunes': renderJeunes(); break;
        case 'messagerie': renderMessagerie(); break;
    }
}

// ==================== PLANNING ====================
function renderPlanning() {
    updateWeekLabel();

    if (state.vehicules.length === 0) {
        document.getElementById('planning-grid').innerHTML = '';
        document.getElementById('planning-grid').classList.add('hidden');
        document.getElementById('planning-empty').classList.remove('hidden');
        return;
    }

    document.getElementById('planning-empty').classList.add('hidden');
    document.getElementById('planning-grid').classList.remove('hidden');

    const days = [];
    for (let i = 0; i < 7; i++) days.push(addDays(state.weekStart, i));
    const today = new Date();

    let html = '<div class="planning-table">';

    // Header row
    html += '<div class="planning-header" style="display:contents">';
    html += '<div class="planning-cell" style="background:var(--bg);border-right:1px solid var(--border-light);border-bottom:1px solid var(--border-light)"></div>';
    for (const day of days) {
        const isToday = isSameDay(day, today);
        html += `<div class="planning-cell${isToday ? ' is-today' : ''}" style="background:${isToday ? '#FDF5EE' : 'var(--bg)'};border-right:1px solid var(--border-light);border-bottom:1px solid var(--border-light);text-align:center">`;
        html += `<span class="day-name">${ADMIN_CONFIG.dayNames[day.getDay()]}</span> `;
        html += `<span class="day-date">${day.getDate()}/${day.getMonth() + 1}</span>`;
        html += '</div>';
    }
    html += '</div>';

    // Vehicle rows
    const activeVehicules = state.vehicules.filter(v => v.actif);
    for (const v of activeVehicules) {
        html += '<div style="display:contents">';
        html += `<div class="planning-cell planning-vehicle-cell">`;
        html += `<span class="vehicle-dot" style="background:${escapeHtml(v.couleur)}"></span>`;
        html += `<span>${escapeHtml(v.nom)}</span>`;
        html += '</div>';

        for (const day of days) {
            const dayStr = formatDate(day);
            const dayEvents = state.evenements.filter(e => e.vehicule_id === v.id && isEventOnDay(e, day));
            const isToday = isSameDay(day, today);

            html += `<div class="planning-cell planning-day-cell${isToday ? ' is-today' : ''}" data-date="${dayStr}" data-vehicule-id="${v.id}">`;
            for (const evt of dayEvents) {
                html += `<div class="event-badge event-${evt.statut}" data-event-id="${evt.id}" title="${escapeHtml(evt.titre)} - ${escapeHtml(evt.lieu)}">`;
                html += `<span class="event-title">${escapeHtml(evt.titre)}</span>`;
                html += `<span class="event-lieu">${escapeHtml(evt.lieu)}</span>`;
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div>';
    }

    html += '</div>';
    document.getElementById('planning-grid').innerHTML = html;

    // Click handlers
    document.querySelectorAll('.planning-day-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
            if (e.target.closest('.event-badge')) return;
            const date = cell.dataset.date;
            const vehiculeId = cell.dataset.vehiculeId;
            openEventForm(null, { date_debut: date, date_fin: date, vehicule_id: vehiculeId });
        });
    });

    document.querySelectorAll('.event-badge').forEach(badge => {
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            const eventId = badge.dataset.eventId;
            const evt = state.evenements.find(ev => ev.id === eventId);
            if (evt) openEventForm(evt);
        });
    });
}

function updateWeekLabel() {
    const start = state.weekStart;
    const end = addDays(start, 6);
    const label = `${formatDateFr(start)} — ${formatDateFr(end)} ${end.getFullYear()}`;
    document.getElementById('week-label').textContent = label;
}

async function navigateWeek(offset) {
    state.weekStart = addDays(state.weekStart, offset * 7);
    await loadEvenements();
    renderPlanning();
}

async function goToToday() {
    state.weekStart = getMonday(new Date());
    await loadEvenements();
    renderPlanning();
}

// ==================== EVENT FORM ====================
function openEventForm(event, defaults = {}) {
    const isEdit = !!event;
    const title = isEdit ? 'Modifier l\'événement' : 'Nouvel événement';

    const vehiculeOptions = state.vehicules
        .filter(v => v.actif)
        .map(v => `<option value="${v.id}" ${(event?.vehicule_id || defaults.vehicule_id) === v.id ? 'selected' : ''}>${escapeHtml(v.nom)}</option>`)
        .join('');

    const statuts = ['planifie', 'confirme', 'en_cours', 'termine', 'annule'];
    const statutOptions = statuts
        .map(s => `<option value="${s}" ${(event?.statut || 'planifie') === s ? 'selected' : ''}>${ADMIN_CONFIG.statutLabels[s]}</option>`)
        .join('');

    const defaultVillageId = event?.village_id || defaults.village_id || '';
    const villageOptionsHtml = state.villages
        .map(v => `<option value="${v.id}" ${defaultVillageId === v.id ? 'selected' : ''}>${escapeHtml(v.nom)} (${escapeHtml(v.code_postal)})</option>`)
        .join('');

    const html = `
        <form class="admin-form" id="event-form">
            <div class="form-group">
                <label>Titre *</label>
                <input type="text" name="titre" required value="${escapeHtml(event?.titre || defaults.titre || '')}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Véhicule *</label>
                    <select name="vehicule_id" required>
                        <option value="">— Choisir —</option>
                        ${vehiculeOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Statut</label>
                    <select name="statut">${statutOptions}</select>
                </div>
            </div>
            <div class="form-group">
                <label>Lieu *</label>
                <input type="text" name="lieu" required value="${escapeHtml(event?.lieu || defaults.lieu || '')}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Date début *</label>
                    <input type="date" name="date_debut" required value="${event?.date_debut || defaults.date_debut || ''}">
                </div>
                <div class="form-group">
                    <label>Date fin *</label>
                    <input type="date" name="date_fin" required value="${event?.date_fin || defaults.date_fin || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Nb personnes prévu</label>
                    <input type="number" name="nb_personnes_prevu" min="1" value="${event?.nb_personnes_prevu || defaults.nb_personnes_prevu || ''}">
                </div>
                <div class="form-group">
                    <label>Village associé</label>
                    <select name="village_id">
                        <option value="">— Aucun —</option>
                        ${villageOptionsHtml}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea name="notes" rows="3">${escapeHtml(event?.notes || '')}</textarea>
            </div>
            <div class="form-actions">
                ${isEdit ? `<button type="button" class="btn btn-danger btn-sm" id="delete-event-btn">Supprimer</button>` : ''}
                <div style="flex:1"></div>
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Créer'}</button>
            </div>
        </form>
    `;

    openModal(title, html);

    document.getElementById('event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = {
            titre: fd.get('titre'),
            vehicule_id: fd.get('vehicule_id') || null,
            statut: fd.get('statut'),
            lieu: fd.get('lieu'),
            date_debut: fd.get('date_debut'),
            date_fin: fd.get('date_fin'),
            nb_personnes_prevu: fd.get('nb_personnes_prevu') ? parseInt(fd.get('nb_personnes_prevu')) : null,
            village_id: fd.get('village_id') || null,
            notes: fd.get('notes') || null,
            updated_at: new Date().toISOString(),
        };

        if (isEdit) {
            await db.from('evenements').update(data).eq('id', event.id);
        } else {
            await db.from('evenements').insert([data]);
        }

        closeModal();
        await loadEvenements();
        renderPlanning();
    });

    if (isEdit) {
        document.getElementById('delete-event-btn')?.addEventListener('click', () => {
            showConfirm('Supprimer cet événement ?', async () => {
                await db.from('evenements').delete().eq('id', event.id);
                closeModal();
                await loadEvenements();
                renderPlanning();
            });
        });
    }
}

// ==================== VEHICULES ====================
async function renderVehicules() {
    const container = document.getElementById('vehicules-list');

    if (state.vehicules.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🚐</span>
                <h3>Aucun véhicule</h3>
                <p>Ajoutez votre premier véhicule pour commencer.</p>
            </div>
        `;
        return;
    }

    let html = '<div class="vehicule-cards">';

    for (const v of state.vehicules) {
        const members = await loadEquipeMembers(v.id);
        html += `
            <div class="vehicule-card ${v.actif ? '' : 'vehicule-inactive'}">
                <div class="vehicule-card-header">
                    <div class="vehicule-color-bar" style="background:${escapeHtml(v.couleur)}"></div>
                    <div class="vehicule-card-info">
                        <h3>${escapeHtml(v.nom)}</h3>
                        <span class="vehicule-type">${escapeHtml(v.type)}${v.actif ? '' : ' — Inactif'}</span>
                    </div>
                    <div class="vehicule-card-actions">
                        <button class="btn btn-ghost btn-sm" onclick="openVehiculeForm(state.vehicules.find(x=>x.id==='${v.id}'))">Modifier</button>
                    </div>
                </div>
                <div class="vehicule-card-body">
                    ${v.description ? `<p class="vehicule-description">${escapeHtml(v.description)}</p>` : ''}
                    <div class="team-section">
                        <h4>Équipe (${members.length})</h4>
                        <div class="team-members">
                            ${members.map(m => `
                                <span class="team-member">
                                    ${escapeHtml(m.jeunes?.prenom)} ${escapeHtml(m.jeunes?.nom)}
                                    <button class="remove-member" data-member-id="${m.id}" title="Retirer">&times;</button>
                                </span>
                            `).join('')}
                            <button class="add-member-btn" data-vehicule-id="${v.id}">+ Ajouter</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;

    // Remove member handlers
    container.querySelectorAll('.remove-member').forEach(btn => {
        btn.addEventListener('click', async () => {
            const memberId = btn.dataset.memberId;
            await db.from('equipe_membres').delete().eq('id', memberId);
            renderVehicules();
        });
    });

    // Add member handlers
    container.querySelectorAll('.add-member-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            openAddMemberModal(btn.dataset.vehiculeId);
        });
    });
}

function openVehiculeForm(vehicule) {
    const isEdit = !!vehicule;
    const title = isEdit ? 'Modifier le véhicule' : 'Nouveau véhicule';

    const html = `
        <form class="admin-form" id="vehicule-form">
            <div class="form-group">
                <label>Nom *</label>
                <input type="text" name="nom" required value="${escapeHtml(vehicule?.nom || '')}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Type</label>
                    <select name="type">
                        <option value="van" ${(vehicule?.type || 'van') === 'van' ? 'selected' : ''}>Van</option>
                        <option value="camion" ${vehicule?.type === 'camion' ? 'selected' : ''}>Camion</option>
                        <option value="camionnette" ${vehicule?.type === 'camionnette' ? 'selected' : ''}>Camionnette</option>
                        <option value="autre" ${vehicule?.type === 'autre' ? 'selected' : ''}>Autre</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Couleur</label>
                    <input type="color" name="couleur" value="${vehicule?.couleur || '#8B4513'}">
                </div>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" rows="2">${escapeHtml(vehicule?.description || '')}</textarea>
            </div>
            <div class="form-group" style="flex-direction:row;align-items:center;gap:8px">
                <input type="checkbox" name="actif" id="vehicule-actif" ${(vehicule?.actif !== false) ? 'checked' : ''}>
                <label for="vehicule-actif" style="margin:0;cursor:pointer">Actif</label>
            </div>
            <div class="form-actions">
                ${isEdit ? `<button type="button" class="btn btn-danger btn-sm" id="delete-vehicule-btn">Supprimer</button>` : ''}
                <div style="flex:1"></div>
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Créer'}</button>
            </div>
        </form>
    `;

    openModal(title, html);

    document.getElementById('vehicule-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = {
            nom: fd.get('nom'),
            type: fd.get('type'),
            couleur: fd.get('couleur'),
            description: fd.get('description') || null,
            actif: fd.has('actif'),
        };

        if (isEdit) {
            await db.from('vehicules').update(data).eq('id', vehicule.id);
        } else {
            await db.from('vehicules').insert([data]);
        }

        closeModal();
        await loadVehicules();
        renderCurrentView();
    });

    if (isEdit) {
        document.getElementById('delete-vehicule-btn')?.addEventListener('click', () => {
            showConfirm('Supprimer ce véhicule et ses événements associés ?', async () => {
                await db.from('vehicules').delete().eq('id', vehicule.id);
                closeModal();
                await loadVehicules();
                await loadEvenements();
                renderCurrentView();
            });
        });
    }
}

async function openAddMemberModal(vehiculeId) {
    const existingMembers = await loadEquipeMembers(vehiculeId);
    const existingJeuneIds = new Set(existingMembers.map(m => m.jeune_id));
    const available = state.jeunes.filter(j => !existingJeuneIds.has(j.id));

    if (available.length === 0) {
        openModal('Ajouter un membre', '<p style="color:var(--text-secondary)">Aucun jeune disponible à ajouter.</p>');
        return;
    }

    const options = available.map(j =>
        `<option value="${j.id}">${escapeHtml(j.prenom)} ${escapeHtml(j.nom)} (${j.age} ans)</option>`
    ).join('');

    const html = `
        <form class="admin-form" id="add-member-form">
            <div class="form-group">
                <label>Sélectionner un jeune</label>
                <select name="jeune_id" required>${options}</select>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Ajouter</button>
            </div>
        </form>
    `;

    openModal('Ajouter un membre', html);

    document.getElementById('add-member-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        await db.from('equipe_membres').insert([{
            vehicule_id: vehiculeId,
            jeune_id: fd.get('jeune_id'),
        }]);
        closeModal();
        renderVehicules();
    });
}

// ==================== VILLAGES ====================
function renderVillages() {
    const container = document.getElementById('villages-list');
    const filtered = state.villageFilter === 'all'
        ? state.villages
        : state.villages.filter(v => v.statut === state.villageFilter);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="empty-icon">🏘️</span><h3>Aucune demande</h3></div>';
        return;
    }

    let html = '<div class="request-list">';
    for (const v of filtered) {
        const statut = v.statut || 'nouveau';
        html += `
            <div class="request-card">
                <div class="request-header">
                    <div>
                        <h3>${escapeHtml(v.nom)} <span class="status-badge status-${statut}">${ADMIN_CONFIG.statutLabels[statut] || statut}</span></h3>
                        <div class="request-meta">${new Date(v.created_at).toLocaleDateString('fr-FR')} · ${escapeHtml(v.code_postal)}</div>
                    </div>
                </div>
                <div class="request-details">
                    <div class="request-detail"><strong>Contact :</strong> ${escapeHtml(v.contact_nom)}</div>
                    <div class="request-detail"><strong>Email :</strong> ${escapeHtml(v.contact_email)}</div>
                    <div class="request-detail"><strong>Tél :</strong> ${escapeHtml(v.contact_telephone)}</div>
                    <div class="request-detail"><strong>Habitants :</strong> ${v.nombre_habitants}</div>
                    ${v.date_souhaitee ? `<div class="request-detail"><strong>Date souhaitée :</strong> ${new Date(v.date_souhaitee + 'T00:00:00').toLocaleDateString('fr-FR')}</div>` : ''}
                </div>
                ${v.message ? `<div class="request-message">${escapeHtml(v.message)}</div>` : ''}
                <div class="request-actions">
                    ${statut === 'nouveau' ? `
                        <button class="btn btn-success btn-sm" onclick="updateVillageStatut('${v.id}','accepte')">Accepter</button>
                        <button class="btn btn-outline btn-sm" onclick="updateVillageStatut('${v.id}','contacte')">Contacté</button>
                        <button class="btn btn-danger btn-sm" onclick="updateVillageStatut('${v.id}','refuse')">Refuser</button>
                    ` : ''}
                    ${statut === 'contacte' ? `
                        <button class="btn btn-success btn-sm" onclick="updateVillageStatut('${v.id}','accepte')">Accepter</button>
                        <button class="btn btn-danger btn-sm" onclick="updateVillageStatut('${v.id}','refuse')">Refuser</button>
                    ` : ''}
                    ${statut === 'accepte' ? `
                        <button class="btn btn-primary btn-sm" onclick="createEventFromVillage('${v.id}')">Créer un événement</button>
                    ` : ''}
                    ${statut === 'refuse' ? `
                        <button class="btn btn-outline btn-sm" onclick="updateVillageStatut('${v.id}','nouveau')">Réouvrir</button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

async function updateVillageStatut(id, statut) {
    await db.from('villages').update({ statut }).eq('id', id);
    await loadVillages();
    renderVillages();
    updateBadges();
}

function createEventFromVillage(villageId) {
    const v = state.villages.find(x => x.id === villageId);
    if (!v) return;
    openEventForm(null, {
        titre: `Fête à ${v.nom}`,
        lieu: `${v.nom} (${v.code_postal})`,
        date_debut: v.date_souhaitee || '',
        date_fin: v.date_souhaitee || '',
        nb_personnes_prevu: v.nombre_habitants,
        village_id: v.id,
    });
}

// ==================== PROSPECTION ====================
function getProspectionFiltered() {
    const search = state.prospectionSearch.toLowerCase().trim();
    return state.prospection.filter(item => {
        const m = item.municipality;
        const enrichment = item.enrichment || {};
        const matchesStatus = state.prospectionFilter === 'all' || item.statut === state.prospectionFilter;
        const matchesDept = state.prospectionDeptFilter === 'all' || m.department_code === state.prospectionDeptFilter;
        const haystack = `${m.nom} ${m.insee_code} ${m.code_postal || ''} ${enrichment.mairie_email || ''}`.toLowerCase();
        const matchesSearch = !search || haystack.includes(search);
        return matchesStatus && matchesDept && matchesSearch;
    });
}

function renderProspection() {
    renderProspectionStats();

    const container = document.getElementById('prospection-list');
    if (state.prospectionError) {
        container.innerHTML = `
            <div class="empty-state compact-empty">
                <span class="empty-icon">🧭</span>
                <h3>Tables prospection à initialiser</h3>
                <p>Exécutez le script schema.sql dans Supabase, puis relancez l’admin.</p>
                <p class="technical-note">${escapeHtml(state.prospectionError)}</p>
            </div>
        `;
        renderProspectionMap([]);
        return;
    }

    const filtered = getProspectionFiltered();
    renderProspectionList(filtered);
    renderProspectionMap(filtered);
}

function renderProspectionStats() {
    const container = document.getElementById('prospection-stats');
    const total = state.prospection.length;
    const ready = state.prospection.filter(p => p.statut === 'ready_to_contact').length;
    const sent = state.prospection.filter(p => p.statut === 'email_sent').length;
    const toCall = state.prospection.filter(p => p.statut === 'to_call').length;
    const interested = state.prospection.filter(p => p.statut === 'interested').length;

    container.innerHTML = `
        <div class="metric-card"><span>${total}</span><label>Communes</label></div>
        <div class="metric-card"><span>${ready}</span><label>Prêtes</label></div>
        <div class="metric-card"><span>${sent}</span><label>Emails envoyés</label></div>
        <div class="metric-card"><span>${toCall}</span><label>À appeler</label></div>
        <div class="metric-card"><span>${interested}</span><label>Intéressées</label></div>
    `;
}

function renderProspectionList(items) {
    const container = document.getElementById('prospection-list');
    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-state compact-empty">
                <span class="empty-icon">🧭</span>
                <h3>Aucune commune trouvée</h3>
                <p>Lancez une recherche ou modifiez vos filtres.</p>
            </div>
        `;
        return;
    }

    const statusOptions = Object.entries(ADMIN_CONFIG.prospectionStatusLabels)
        .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`)
        .join('');

    container.innerHTML = `
        <div class="prospection-count">${items.length} commune${items.length > 1 ? 's' : ''} affichée${items.length > 1 ? 's' : ''}</div>
        <div class="prospection-list">
            ${items.map(item => {
                const m = item.municipality;
                const e = item.enrichment || {};
                const commerceCount = e.commerce_count ?? '—';
                const email = e.mairie_email || 'Email mairie manquant';
                const phone = e.mairie_phone || 'Téléphone manquant';
                const statusLabel = ADMIN_CONFIG.prospectionStatusLabels[item.statut] || item.statut;
                return `
                    <article class="prospection-card" data-prospect-id="${item.id}">
                        <div class="prospection-card-head">
                            <div>
                                <h3>${escapeHtml(m.nom)} <span class="status-badge status-prospect-${item.statut}">${escapeHtml(statusLabel)}</span></h3>
                                <div class="request-meta">${escapeHtml(m.department_code)} · ${m.population ?? '—'} hab. · ${commerceCount} commerce${commerceCount === 1 ? '' : 's'} estimé${commerceCount === 1 ? '' : 's'}</div>
                            </div>
                            <button class="btn btn-ghost btn-sm" data-action="details">Détails</button>
                        </div>
                        <div class="request-details">
                            <div class="request-detail"><strong>Email :</strong> ${escapeHtml(email)}</div>
                            <div class="request-detail"><strong>Tél :</strong> ${escapeHtml(phone)}</div>
                            <div class="request-detail"><strong>Horaires :</strong> ${escapeHtml(e.mairie_opening_hours || 'Non renseignés')}</div>
                            <div class="request-detail"><strong>Source commerces :</strong> ${escapeHtml(e.commerce_source || 'OSM')}</div>
                        </div>
                        <div class="prospection-card-actions">
                            <select class="prospection-status-select" data-action="status">
                                ${statusOptions}
                            </select>
                            <button class="btn btn-outline btn-sm" data-action="research">Lancer une recherche</button>
                            <button class="btn btn-primary btn-sm" data-action="email" ${e.mairie_email ? '' : 'disabled'}>Prévisualiser email</button>
                        </div>
                    </article>
                `;
            }).join('')}
        </div>
    `;

    container.querySelectorAll('.prospection-card').forEach(card => {
        const item = state.prospection.find(p => p.id === card.dataset.prospectId);
        const select = card.querySelector('[data-action="status"]');
        if (select && item) select.value = item.statut;

        card.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action || !item) return;
            if (action === 'details') openProspectionDetails(item.id);
            if (action === 'email') openProspectionEmailPreview(item.id);
            if (action === 'research') runMunicipalityResearch(item.id);
        });

        select?.addEventListener('change', async () => {
            await updateProspectionRecord(item.id, { statut: select.value });
        });
    });
}

function renderProspectionMap(items) {
    const mapEl = document.getElementById('prospection-map');
    const fallbackEl = document.getElementById('prospection-map-fallback');
    const points = items.filter(item => item.municipality.latitude && item.municipality.longitude);

    if (typeof L === 'undefined') {
        mapEl.classList.add('hidden');
        fallbackEl.classList.remove('hidden');
        renderProspectionMapFallback(points);
        return;
    }

    fallbackEl.classList.add('hidden');
    mapEl.classList.remove('hidden');

    if (!state.prospectionMap) {
        state.prospectionMap = L.map('prospection-map', {
            scrollWheelZoom: true,
        }).setView([48.05, -2.2], 8);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap',
        }).addTo(state.prospectionMap);
        state.prospectionMap.on('click', handleProspectionMapClick);
    }

    state.prospectionMarkers.forEach(marker => marker.remove());
    state.prospectionMarkers = [];

    points.forEach(item => {
        const m = item.municipality;
        const color = ADMIN_CONFIG.prospectionStatusColors[item.statut] || ADMIN_CONFIG.prospectionStatusColors.to_review;
        const marker = L.circleMarker([Number(m.latitude), Number(m.longitude)], {
            radius: 8,
            color,
            fillColor: color,
            fillOpacity: 0.85,
            weight: 2,
        }).addTo(state.prospectionMap);
        marker.bindPopup(`<strong>${escapeHtml(m.nom)}</strong><br>${escapeHtml(ADMIN_CONFIG.prospectionStatusLabels[item.statut] || item.statut)}`);
        marker.on('click', () => {
            if (!state.prospectionDrawing) openProspectionDetails(item.id);
        });
        state.prospectionMarkers.push(marker);
    });

    setTimeout(() => {
        state.prospectionMap.invalidateSize();
        if (state.prospectionMarkers.length > 0) {
            const group = L.featureGroup(state.prospectionMarkers);
            state.prospectionMap.fitBounds(group.getBounds().pad(0.15), { maxZoom: 10 });
        }
        renderProspectionDraftZone();
    }, 100);
}

function handleProspectionMapClick(event) {
    if (!state.prospectionDrawing) return;
    addProspectionDraftPoint(event.latlng.lat, event.latlng.lng);
}

function setProspectionDrawing(enabled) {
    state.prospectionDrawing = enabled;
    const btn = document.getElementById('prospection-draw-btn');
    const mapEl = document.getElementById('prospection-map');
    if (btn) btn.textContent = enabled ? 'Terminer le dessin' : 'Dessiner une zone';
    if (btn) btn.classList.toggle('active-draw', enabled);
    if (mapEl) mapEl.classList.toggle('is-drawing', enabled);
    updateProspectionDrawButtons();
}

function addProspectionDraftPoint(lat, lng, index = null) {
    const point = { lat: Number(lat), lng: Number(lng) };
    if (index === null || index >= state.prospectionDraftPoints.length) {
        state.prospectionDraftPoints.push(point);
        state.prospectionSelectedPoint = state.prospectionDraftPoints.length - 1;
    } else {
        state.prospectionDraftPoints.splice(index, 0, point);
        state.prospectionSelectedPoint = index;
    }
    renderProspectionDraftZone();
    updateProspectionDrawButtons();
}

function updateProspectionDraftPoint(index, latlng) {
    if (!state.prospectionDraftPoints[index]) return;
    state.prospectionDraftPoints[index] = {
        lat: Number(latlng.lat),
        lng: Number(latlng.lng),
    };
    renderProspectionDraftZone();
}

function deleteSelectedProspectionPoint() {
    if (state.prospectionSelectedPoint === null) return;
    state.prospectionDraftPoints.splice(state.prospectionSelectedPoint, 1);
    state.prospectionSelectedPoint = state.prospectionDraftPoints.length
        ? Math.min(state.prospectionSelectedPoint, state.prospectionDraftPoints.length - 1)
        : null;
    renderProspectionDraftZone();
    updateProspectionDrawButtons();
}

function clearProspectionDraftZone() {
    state.prospectionDraftPoints = [];
    state.prospectionSelectedPoint = null;
    setProspectionDrawing(false);
    renderProspectionDraftZone();
    updateProspectionDrawButtons();
}

function renderProspectionDraftZone() {
    if (!state.prospectionMap || typeof L === 'undefined') return;

    if (state.prospectionDraftPolygon) {
        state.prospectionDraftPolygon.remove();
        state.prospectionDraftPolygon = null;
    }
    state.prospectionDraftMarkers.forEach(marker => marker.remove());
    state.prospectionDraftMarkers = [];
    state.prospectionDraftMidpoints.forEach(marker => marker.remove());
    state.prospectionDraftMidpoints = [];

    const points = state.prospectionDraftPoints.map(p => [p.lat, p.lng]);
    if (points.length >= 3) {
        state.prospectionDraftPolygon = L.polygon(points, {
            color: '#24D3A2',
            fillColor: '#24D3A2',
            fillOpacity: 0.18,
            weight: 3,
            dashArray: '8 8',
        }).addTo(state.prospectionMap);
    } else if (points.length >= 2) {
        state.prospectionDraftPolygon = L.polyline(points, {
            color: '#24D3A2',
            weight: 3,
            dashArray: '8 8',
        }).addTo(state.prospectionMap);
    }

    state.prospectionDraftPoints.forEach((point, index) => {
        const marker = L.marker([point.lat, point.lng], {
            draggable: true,
            icon: L.divIcon({
                className: `zone-vertex${state.prospectionSelectedPoint === index ? ' selected' : ''}`,
                iconSize: [18, 18],
                iconAnchor: [9, 9],
            }),
            zIndexOffset: 2000,
        }).addTo(state.prospectionMap);
        marker.on('click', (event) => {
            L.DomEvent.stopPropagation(event.originalEvent || event);
            state.prospectionSelectedPoint = index;
            renderProspectionDraftZone();
            updateProspectionDrawButtons();
        });
        marker.on('dragend', () => {
            updateProspectionDraftPoint(index, marker.getLatLng());
        });
        state.prospectionDraftMarkers.push(marker);
    });

    if (state.prospectionDraftPoints.length >= 2) {
        const segmentCount = state.prospectionDraftPoints.length >= 3
            ? state.prospectionDraftPoints.length
            : state.prospectionDraftPoints.length - 1;
        for (let i = 0; i < segmentCount; i++) {
            const a = state.prospectionDraftPoints[i];
            const b = state.prospectionDraftPoints[(i + 1) % state.prospectionDraftPoints.length];
            const midpoint = {
                lat: (a.lat + b.lat) / 2,
                lng: (a.lng + b.lng) / 2,
            };
            const marker = L.marker([midpoint.lat, midpoint.lng], {
                icon: L.divIcon({
                    className: 'zone-midpoint',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6],
                }),
                zIndexOffset: 1500,
            }).addTo(state.prospectionMap);
            marker.on('click', (event) => {
                L.DomEvent.stopPropagation(event.originalEvent || event);
                addProspectionDraftPoint(midpoint.lat, midpoint.lng, i + 1);
            });
            state.prospectionDraftMidpoints.push(marker);
        }
    }
}

function updateProspectionDrawButtons() {
    const hasPoints = state.prospectionDraftPoints.length > 0;
    const hasPolygon = state.prospectionDraftPoints.length >= 3;
    const hasSelected = state.prospectionSelectedPoint !== null;
    document.getElementById('prospection-delete-point-btn')?.toggleAttribute('disabled', !hasSelected);
    document.getElementById('prospection-clear-zone-btn')?.toggleAttribute('disabled', !hasPoints);
    document.getElementById('prospection-save-zone-btn')?.toggleAttribute('disabled', !hasPolygon);
}

function renderProspectionMapFallback(points) {
    const fallbackEl = document.getElementById('prospection-map-fallback');
    if (points.length === 0) {
        fallbackEl.innerHTML = '<div class="map-empty">Aucune coordonnée à afficher.</div>';
        return;
    }
    const lats = points.map(p => Number(p.municipality.latitude));
    const lngs = points.map(p => Number(p.municipality.longitude));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    fallbackEl.innerHTML = points.map(item => {
        const m = item.municipality;
        const left = ((Number(m.longitude) - minLng) / Math.max(maxLng - minLng, 0.1)) * 86 + 7;
        const top = (1 - ((Number(m.latitude) - minLat) / Math.max(maxLat - minLat, 0.1))) * 82 + 9;
        const color = ADMIN_CONFIG.prospectionStatusColors[item.statut] || ADMIN_CONFIG.prospectionStatusColors.to_review;
        return `<button class="map-dot" style="left:${left}%;top:${top}%;background:${color}" title="${escapeHtml(m.nom)}" data-prospect-id="${item.id}"></button>`;
    }).join('');

    fallbackEl.querySelectorAll('.map-dot').forEach(dot => {
        dot.addEventListener('click', () => openProspectionDetails(dot.dataset.prospectId));
    });
}

function buildProspectionEmail(item) {
    const commune = item.municipality.nom;
    return {
        subject: ADMIN_CONFIG.prospectionEmail.subject.replaceAll('{commune}', commune),
        body: ADMIN_CONFIG.prospectionEmail.body.replaceAll('{commune}', commune),
        recipient: item.enrichment?.mairie_email || '',
    };
}

function openManualProspectionForm() {
    const statusOptions = Object.entries(ADMIN_CONFIG.prospectionStatusLabels)
        .map(([value, label]) => `<option value="${value}" ${value === 'ready_to_contact' ? 'selected' : ''}>${escapeHtml(label)}</option>`)
        .join('');

    const html = `
        <form class="admin-form" id="manual-prospection-form">
            <div class="form-row">
                <div class="form-group">
                    <label>Nom de la commune *</label>
                    <input type="text" name="nom" required placeholder="Ex. Saint-Gonnery">
                </div>
                <div class="form-group">
                    <label>Code INSEE *</label>
                    <input type="text" name="insee_code" required placeholder="Ex. 56217">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Code postal</label>
                    <input type="text" name="code_postal" placeholder="Ex. 56920">
                </div>
                <div class="form-group">
                    <label>Département *</label>
                    <select name="department_code" required>
                        <option value="">— Choisir —</option>
                        <option value="22">Côtes-d’Armor</option>
                        <option value="35">Ille-et-Vilaine</option>
                        <option value="56">Morbihan</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Population</label>
                    <input type="number" name="population" min="0" placeholder="Ex. 420">
                </div>
                <div class="form-group">
                    <label>Commerces estimés</label>
                    <input type="number" name="commerce_count" min="0" placeholder="Ex. 1">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Latitude</label>
                    <input type="number" name="latitude" step="0.000001" placeholder="Ex. 48.123456">
                </div>
                <div class="form-group">
                    <label>Longitude</label>
                    <input type="number" name="longitude" step="0.000001" placeholder="Ex. -2.123456">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Email mairie</label>
                    <input type="email" name="mairie_email" placeholder="mairie@commune.fr">
                </div>
                <div class="form-group">
                    <label>Téléphone mairie</label>
                    <input type="tel" name="mairie_phone" placeholder="02 ...">
                </div>
            </div>
            <div class="form-group">
                <label>Horaires mairie</label>
                <textarea name="mairie_opening_hours" rows="3" placeholder="Ex. Lundi et jeudi : 9h-12h"></textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Statut</label>
                    <select name="statut">${statusOptions}</select>
                </div>
                <div class="form-group">
                    <label>Prochaine action</label>
                    <input type="date" name="next_action_at">
                </div>
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea name="notes" rows="3" placeholder="Contexte, source, échange déjà fait..."></textarea>
            </div>
            <div class="technical-note">
                Le code INSEE sert d’identifiant stable pour éviter les doublons. Les coordonnées sont optionnelles, mais nécessaires pour l’affichage sur la carte.
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Ajouter</button>
            </div>
        </form>
    `;

    openModal('Ajouter une commune prospectée', html);

    document.getElementById('manual-prospection-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const fd = new FormData(event.target);
        await saveManualProspection({
            nom: fd.get('nom')?.trim(),
            insee_code: fd.get('insee_code')?.trim(),
            code_postal: fd.get('code_postal')?.trim() || null,
            department_code: fd.get('department_code'),
            population: fd.get('population') ? parseInt(fd.get('population')) : null,
            latitude: fd.get('latitude') ? parseFloat(fd.get('latitude')) : null,
            longitude: fd.get('longitude') ? parseFloat(fd.get('longitude')) : null,
            commerce_count: fd.get('commerce_count') ? parseInt(fd.get('commerce_count')) : null,
            mairie_email: fd.get('mairie_email')?.trim() || null,
            mairie_phone: fd.get('mairie_phone')?.trim() || null,
            mairie_opening_hours: fd.get('mairie_opening_hours')?.trim() || null,
            statut: fd.get('statut'),
            next_action_at: fd.get('next_action_at') || null,
            notes: fd.get('notes')?.trim() || null,
        });
    });
}

async function saveManualProspection(input) {
    const submitBtn = document.querySelector('#manual-prospection-form button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Ajout...';

    try {
        const municipalityPayload = {
            insee_code: input.insee_code,
            nom: input.nom,
            code_postal: input.code_postal,
            department_code: input.department_code,
            population: input.population,
            latitude: input.latitude,
            longitude: input.longitude,
            population_source: 'manual',
            updated_at: new Date().toISOString(),
        };

        const { data: municipalityRows, error: municipalityError } = await db
            .from('municipalities')
            .upsert([municipalityPayload], { onConflict: 'insee_code' })
            .select('*')
            .limit(1);
        if (municipalityError) throw municipalityError;

        const municipality = municipalityRows?.[0];
        if (!municipality) throw new Error('Commune non créée.');

        const now = new Date().toISOString();
        const { error: enrichmentError } = await db
            .from('municipality_enrichments')
            .upsert([{
                municipality_id: municipality.id,
                mairie_email: input.mairie_email,
                mairie_phone: input.mairie_phone,
                mairie_opening_hours: input.mairie_opening_hours,
                contact_source: 'manual',
                contact_checked_at: now,
                commerce_count: input.commerce_count,
                commerce_source: 'manual',
                commerce_checked_at: now,
                commerce_confidence: 'verified',
                updated_at: now,
            }], { onConflict: 'municipality_id' });
        if (enrichmentError) throw enrichmentError;

        const { error: recordError } = await db
            .from('prospection_records')
            .upsert([{
                municipality_id: municipality.id,
                statut: input.statut,
                notes: input.notes,
                next_action_at: input.next_action_at,
                updated_at: now,
            }], { onConflict: 'municipality_id' });
        if (recordError) throw recordError;

        closeModal();
        await loadProspection();
        renderProspection();
        updateBadges();
    } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Ajouter';
        openModal('Ajout impossible', `<p class="technical-note">${escapeHtml(err.message)}</p>`);
    }
}

function openProspectionDetails(recordId) {
    const item = state.prospection.find(p => p.id === recordId);
    if (!item) return;

    const m = item.municipality;
    const e = item.enrichment || {};
    const statusOptions = Object.entries(ADMIN_CONFIG.prospectionStatusLabels)
        .map(([value, label]) => `<option value="${value}" ${item.statut === value ? 'selected' : ''}>${escapeHtml(label)}</option>`)
        .join('');

    const html = `
        <form class="admin-form" id="prospection-details-form">
            <div class="prospection-detail-grid">
                <div><strong>Code INSEE</strong><span>${escapeHtml(m.insee_code)}</span></div>
                <div><strong>Département</strong><span>${escapeHtml(m.department_code)}</span></div>
                <div><strong>Population</strong><span>${m.population ?? '—'}</span></div>
                <div><strong>Commerces OSM</strong><span>${e.commerce_count ?? '—'}</span></div>
                <div><strong>Email mairie</strong><span>${escapeHtml(e.mairie_email || 'Non renseigné')}</span></div>
                <div><strong>Téléphone mairie</strong><span>${escapeHtml(e.mairie_phone || 'Non renseigné')}</span></div>
            </div>
            <div class="form-group">
                <label>Horaires mairie</label>
                <textarea readonly rows="3">${escapeHtml(e.mairie_opening_hours || 'Non renseignés')}</textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Statut</label>
                    <select name="statut">${statusOptions}</select>
                </div>
                <div class="form-group">
                    <label>Prochaine action</label>
                    <input type="date" name="next_action_at" value="${item.next_action_at || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea name="notes" rows="4">${escapeHtml(item.notes || '')}</textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-outline" id="prospection-research-modal">Lancer une recherche</button>
                <button type="button" class="btn btn-outline" id="prospection-email-modal" ${e.mairie_email ? '' : 'disabled'}>Prévisualiser email</button>
                <div style="flex:1"></div>
                <button type="button" class="btn btn-outline" onclick="closeModal()">Fermer</button>
                <button type="submit" class="btn btn-primary">Enregistrer</button>
            </div>
        </form>
    `;

    openModal(m.nom, html);

    document.getElementById('prospection-details-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const fd = new FormData(event.target);
        await updateProspectionRecord(item.id, {
            statut: fd.get('statut'),
            next_action_at: fd.get('next_action_at') || null,
            notes: fd.get('notes') || null,
        });
        closeModal();
    });
    document.getElementById('prospection-research-modal').addEventListener('click', () => runMunicipalityResearch(item.id));
    document.getElementById('prospection-email-modal').addEventListener('click', () => openProspectionEmailPreview(item.id));
}

async function openProspectionEmailPreview(recordId) {
    const item = state.prospection.find(p => p.id === recordId);
    if (!item) return;

    const email = buildProspectionEmail(item);
    const html = `
        <form class="admin-form" id="prospection-email-form">
            <div class="form-group">
                <label>Destinataire</label>
                <input type="email" name="recipient_email" required value="${escapeHtml(email.recipient)}">
            </div>
            <div class="form-group">
                <label>Objet</label>
                <input type="text" name="subject" required value="${escapeHtml(email.subject)}">
            </div>
            <div class="form-group">
                <label>Message</label>
                <textarea name="body" rows="12" required>${escapeHtml(email.body)}</textarea>
            </div>
            <div class="technical-note">
                L’envoi réel passe par une fonction serveur pour protéger les identifiants Gmail SMTP.
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary" id="prospection-send-email">Envoyer</button>
            </div>
        </form>
    `;

    openModal(`Email à ${item.municipality.nom}`, html);
    if (['to_review', 'ready_to_contact'].includes(item.statut)) {
        await updateProspectionRecord(item.id, { statut: 'email_previewed' }, { silent: true });
    }

    document.getElementById('prospection-email-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const btn = document.getElementById('prospection-send-email');
        btn.disabled = true;
        btn.textContent = 'Envoi...';
        const fd = new FormData(event.target);
        await sendProspectionEmail(item, {
            recipient_email: fd.get('recipient_email'),
            subject: fd.get('subject'),
            body: fd.get('body'),
        }, btn);
    });
}

async function sendProspectionEmail(item, payload, button) {
    const { data: emailRows, error: insertError } = await db.from('prospection_emails').insert([{
        municipality_id: item.municipality_id,
        prospection_record_id: item.id,
        recipient_email: payload.recipient_email,
        subject: payload.subject,
        body: payload.body,
        statut: 'queued',
        created_by: state.user?.id || null,
    }]).select('*').limit(1);

    if (insertError) {
        button.disabled = false;
        button.textContent = 'Envoyer';
        openModal('Envoi impossible', `<p class="technical-note">${escapeHtml(insertError.message)}</p>`);
        return;
    }

    const email = emailRows?.[0];
    try {
        const result = await callAdminFunction('send-prospection-email', { email_id: email.id });
        await db.from('prospection_emails').update({
            statut: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: result?.message_id || null,
        }).eq('id', email.id);
        await updateProspectionRecord(item.id, {
            statut: 'email_sent',
            last_contacted_at: new Date().toISOString(),
        }, { silent: true });
        closeModal();
        await loadProspection();
        renderProspection();
        updateBadges();
    } catch (err) {
        await db.from('prospection_emails').update({
            statut: 'failed',
            error_message: err.message,
        }).eq('id', email.id);
        button.disabled = false;
        button.textContent = 'Réessayer';
        openModal('Envoi non configuré', `
            <p>Le brouillon a été enregistré, mais la fonction serveur d’envoi n’a pas répondu.</p>
            <p class="technical-note">${escapeHtml(err.message)}</p>
        `);
    }
}

async function updateProspectionRecord(recordId, patch, options = {}) {
    const data = {
        ...patch,
        updated_at: new Date().toISOString(),
    };
    const { error } = await db.from('prospection_records').update(data).eq('id', recordId);
    if (error) {
        console.error('Prospection update error:', error);
        return;
    }
    await loadProspection();
    if (!options.silent) {
        renderProspection();
        updateBadges();
    }
}

async function runProspectionScan(areaId = null) {
    if (state.prospectionScanRunning) return;
    state.prospectionScanRunning = true;
    const mairieSources = getSelectedProspectionInfoSources();
    const scanBtn = document.getElementById('prospection-scan-btn');
    const scanStartedAt = Date.now();
    let lastProgress = 0;
    let lastStatusLabel = 'Préparation du scan...';
    const statusTimer = setInterval(() => {
        if (!state.prospectionScanRunning) return;
        const elapsed = Math.max(1, Math.round((Date.now() - scanStartedAt) / 1000));
        showProspectionScanStatus(`${lastStatusLabel} · ${elapsed}s`, lastProgress);
    }, 5000);
    if (scanBtn) {
        scanBtn.disabled = true;
        scanBtn.textContent = 'Scan en cours...';
    }
    showProspectionScanStatus('Préparation du scan...', 0);

    try {
        let area = null;
        if (areaId) {
            const { data: areaRows, error: areaError } = await db
                .from('prospection_areas')
                .select('*')
                .eq('id', areaId)
                .limit(1);
            if (areaError) throw areaError;
            area = areaRows?.[0];
        } else {
            const areaConfig = withProspectionInfoSources(ADMIN_CONFIG.initialProspectionArea, mairieSources);
            let { data: existingAreas } = await db
                .from('prospection_areas')
                .select('*')
                .eq('nom', areaConfig.nom)
                .limit(1);

            area = existingAreas?.[0];
            if (!area) {
                const { data: insertedAreas, error: insertError } = await db.from('prospection_areas').insert([areaConfig]).select('*').limit(1);
                if (insertError) throw insertError;
                area = insertedAreas?.[0];
            } else {
                const refreshedConfig = {
                    ...(area.config || {}),
                    mairie_sources: mairieSources,
                };
                const { data: updatedAreas, error: updateAreaError } = await db
                    .from('prospection_areas')
                    .update({ config: refreshedConfig, updated_at: new Date().toISOString() })
                    .eq('id', area.id)
                    .select('*')
                    .limit(1);
                if (updateAreaError) throw updateAreaError;
                area = updatedAreas?.[0] || { ...area, config: refreshedConfig };
            }
        }
        if (!area) throw new Error('Zone de prospection introuvable.');

        let jobId = null;
        let result = null;
        do {
            lastStatusLabel = jobId
                ? 'Analyse du lot suivant...'
                : 'Création du job et détection des communes candidates...';
            showProspectionScanStatus(lastStatusLabel, lastProgress);
            result = await callAdminFunction('scan-prospection-area', {
                area_id: jobId ? undefined : area.id,
                job_id: jobId,
                batch_size: 2,
            }, { timeoutMs: 90_000 });
            jobId = result.job_id;
            const label = [
                `${result.processed_candidates || 0}/${result.total_candidates || 0} communes analysées`,
                `${result.saved_count || 0} ajoutées`,
                `${result.skipped_count || 0} écartées`,
            ].join(' · ');
            lastStatusLabel = label;
            lastProgress = result.progress || 0;
            showProspectionScanStatus(label, lastProgress);
            await loadProspection();
            renderProspection();
        } while (result?.has_more);

        showProspectionScanStatus(`Scan terminé · ${result?.saved_count || 0} ajoutées · ${result?.skipped_count || 0} écartées`, 100);
        await loadProspection();
        renderProspection();
        updateBadges();
    } catch (err) {
        openModal('Scan interrompu', `
            <p>La zone est prête, mais le scan automatique n’a pas pu aller au bout.</p>
            <p class="technical-note">${escapeHtml(err.message)}</p>
        `);
    } finally {
        clearInterval(statusTimer);
        state.prospectionScanRunning = false;
        if (scanBtn) {
            scanBtn.disabled = false;
            scanBtn.textContent = 'Lancer la recherche 22/35/56';
        }
    }
}

function getSelectedProspectionInfoSources() {
    const allInputs = Array.from(document.querySelectorAll('input[name="prospection-source"]'));
    if (!allInputs.length) return [...state.prospectionInfoSources];

    const selected = allInputs.filter(input => input.checked).map(input => input.value);
    if (!selected.length) {
        allInputs[0].checked = true;
        selected.push(allInputs[0].value);
    }
    state.prospectionInfoSources = selected;
    return [...state.prospectionInfoSources];
}

function withProspectionInfoSources(area, sources) {
    return {
        ...area,
        config: {
            ...(area.config || {}),
            mairie_sources: sources,
        },
    };
}

function showProspectionScanStatus(label, progress) {
    const statusEl = document.getElementById('prospection-scan-status');
    if (!statusEl) return;
    const pct = Math.max(0, Math.min(100, Number(progress) || 0));
    statusEl.classList.remove('hidden');
    statusEl.innerHTML = `
        <div class="scan-status-row">
            <span>${escapeHtml(label)}</span>
            <strong>${pct}%</strong>
        </div>
        <div class="scan-progress"><span style="width:${pct}%"></span></div>
    `;
    if (pct >= 100) {
        setTimeout(() => statusEl.classList.add('hidden'), 5000);
    }
}

async function saveDraftAreaAndRunScan() {
    if (state.prospectionDraftPoints.length < 3) {
        openModal('Zone incomplète', '<p>Ajoutez au moins 3 points pour définir une zone.</p>');
        return;
    }

    const saveBtn = document.getElementById('prospection-save-zone-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Sauvegarde...';
    }

    try {
        const nameInput = document.getElementById('prospection-area-name');
        const areaName = nameInput?.value?.trim() || 'Zone personnalisée';
        const polygon = state.prospectionDraftPoints.map(point => [point.lng, point.lat]);
        polygon.push([state.prospectionDraftPoints[0].lng, state.prospectionDraftPoints[0].lat]);

        const { data: areaRows, error } = await db.from('prospection_areas').insert([{
            nom: areaName,
            type: 'polygon',
            config: {
                geometry: {
                    type: 'Polygon',
                    coordinates: [polygon],
                },
                population_max: 500,
                commerce_max: 2,
                commerce_source: 'openstreetmap',
                mairie_sources: getSelectedProspectionInfoSources(),
            },
            statut: 'ready',
        }]).select('*').limit(1);
        if (error) throw error;

        const area = areaRows?.[0];
        if (!area) throw new Error('Zone non créée.');

        setProspectionDrawing(false);
        await runProspectionScan(area.id);
    } catch (err) {
        openModal('Zone non sauvegardée', `<p class="technical-note">${escapeHtml(err.message)}</p>`);
    } finally {
        if (saveBtn) {
            saveBtn.textContent = 'Sauvegarder et lancer';
            updateProspectionDrawButtons();
        }
    }
}

async function runMunicipalityResearch(recordId) {
    const item = state.prospection.find(p => p.id === recordId);
    if (!item) return;

    const { data: researchRows, error } = await db.from('municipality_researches').insert([{
        municipality_id: item.municipality_id,
        statut: 'queued',
    }]).select('*').limit(1);

    if (error) {
        openModal('Recherche impossible', `<p class="technical-note">${escapeHtml(error.message)}</p>`);
        return;
    }

    const research = researchRows?.[0];
    try {
        await callAdminFunction('research-municipality', {
            municipality_id: item.municipality_id,
            research_id: research.id,
        });
        openModal('Recherche lancée', '<p>La recherche contextuelle a été lancée pour cette commune.</p>');
    } catch (err) {
        await db.from('municipality_researches').update({
            statut: 'failed',
            error_message: err.message,
        }).eq('id', research.id);
        openModal('Recherche non configurée', `
            <p>La demande de recherche a été enregistrée, mais la fonction serveur <strong>research-municipality</strong> n’a pas répondu.</p>
            <p class="technical-note">${escapeHtml(err.message)}</p>
        `);
    }
}

async function callAdminFunction(name, payload, options = {}) {
    const { data: { session } } = await db.auth.getSession();
    if (!session?.access_token) throw new Error('Session admin expirée.');

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || 60_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
        response = await fetch(`${ADMIN_CONFIG.supabase.url}/functions/v1/${name}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': ADMIN_CONFIG.supabase.anonKey,
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error(`La fonction ${name} ne répond pas après ${Math.round(timeoutMs / 1000)}s.`);
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }

    const text = await response.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }

    if (!response.ok) {
        throw new Error(json?.error || text || `Erreur HTTP ${response.status}`);
    }
    return json;
}

// ==================== JEUNES ====================
function renderJeunes() {
    const container = document.getElementById('jeunes-list');
    const filtered = state.jeuneFilter === 'all'
        ? state.jeunes
        : state.jeunes.filter(j => j.statut === state.jeuneFilter);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="empty-icon">🙋</span><h3>Aucune candidature</h3></div>';
        return;
    }

    let html = '<div class="request-list">';
    for (const j of filtered) {
        const statut = j.statut || 'nouveau';
        html += `
            <div class="request-card">
                <div class="request-header">
                    <div>
                        <h3>${escapeHtml(j.prenom)} ${escapeHtml(j.nom)} <span class="status-badge status-${statut}">${ADMIN_CONFIG.statutLabels[statut] || statut}</span></h3>
                        <div class="request-meta">${new Date(j.created_at).toLocaleDateString('fr-FR')} · ${j.age} ans</div>
                    </div>
                </div>
                <div class="request-details">
                    <div class="request-detail"><strong>Email :</strong> ${escapeHtml(j.email)}</div>
                    <div class="request-detail"><strong>Tél :</strong> ${escapeHtml(j.telephone)}</div>
                </div>
                <div class="request-message">${escapeHtml(j.motivation)}</div>
                <div class="request-actions">
                    ${statut === 'nouveau' ? `
                        <button class="btn btn-success btn-sm" onclick="updateJeuneStatut('${j.id}','accepte')">Accepter</button>
                        <button class="btn btn-danger btn-sm" onclick="updateJeuneStatut('${j.id}','refuse')">Refuser</button>
                    ` : ''}
                    ${statut === 'accepte' ? `
                        <button class="btn btn-outline btn-sm" onclick="updateJeuneStatut('${j.id}','refuse')">Refuser</button>
                    ` : ''}
                    ${statut === 'refuse' ? `
                        <button class="btn btn-outline btn-sm" onclick="updateJeuneStatut('${j.id}','nouveau')">Réouvrir</button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

async function updateJeuneStatut(id, statut) {
    await db.from('jeunes').update({ statut }).eq('id', id);
    await loadJeunes();
    renderJeunes();
    updateBadges();
}

// ==================== MESSAGERIE ====================
async function loadMsgUnreadCounts() {
    const { data } = await db
        .from('messages')
        .select('jeune_id')
        .eq('expediteur', 'jeune')
        .eq('lu', false);
    const counts = {};
    (data || []).forEach(m => {
        counts[m.jeune_id] = (counts[m.jeune_id] || 0) + 1;
    });
    state.msgUnreadCounts = counts;
}

async function loadMsgLastMessages() {
    const { data } = await db
        .from('messages')
        .select('jeune_id, contenu, created_at, expediteur')
        .order('created_at', { ascending: false });
    return data || [];
}

async function loadConversation(jeuneId) {
    const { data } = await db
        .from('messages')
        .select('*')
        .eq('jeune_id', jeuneId)
        .order('created_at', { ascending: true });
    state.msgMessages = data || [];
}

async function markMessagesAsRead(jeuneId) {
    await db
        .from('messages')
        .update({ lu: true })
        .eq('jeune_id', jeuneId)
        .eq('expediteur', 'jeune')
        .eq('lu', false);
    if (state.msgUnreadCounts[jeuneId]) {
        delete state.msgUnreadCounts[jeuneId];
        updateMsgBadge();
    }
}

async function sendMessage(jeuneId, contenu) {
    const { error } = await db.from('messages').insert([{
        jeune_id: jeuneId,
        contenu: contenu.trim(),
        expediteur: 'admin',
        lu: true,
    }]);
    if (error) throw error;
}

function updateMsgBadge() {
    const badge = document.getElementById('badge-messages');
    const total = Object.values(state.msgUnreadCounts).reduce((a, b) => a + b, 0);
    if (total > 0) {
        badge.textContent = total;
        badge.classList.add('visible');
    } else {
        badge.classList.remove('visible');
    }
}

async function renderMessagerie() {
    await loadMsgUnreadCounts();
    updateMsgBadge();
    const allMessages = await loadMsgLastMessages();

    const acceptedJeunes = state.jeunes.filter(j => j.statut === 'accepte');

    const lastMsgMap = {};
    for (const m of allMessages) {
        if (!lastMsgMap[m.jeune_id]) lastMsgMap[m.jeune_id] = m;
    }

    const jeunesWithMessages = state.jeunes.filter(j => lastMsgMap[j.id]);
    const jeunesWithoutMessages = acceptedJeunes.filter(j => !lastMsgMap[j.id]);

    const sortedContacts = [
        ...jeunesWithMessages.sort((a, b) => {
            const ta = new Date(lastMsgMap[a.id]?.created_at || 0);
            const tb = new Date(lastMsgMap[b.id]?.created_at || 0);
            return tb - ta;
        }),
        ...jeunesWithoutMessages.sort((a, b) => a.prenom.localeCompare(b.prenom)),
    ];

    renderMsgContacts(sortedContacts, lastMsgMap);
}

function renderMsgContacts(contacts, lastMsgMap) {
    const container = document.getElementById('msg-contacts-list');
    const searchInput = document.getElementById('msg-search');
    const searchTerm = (searchInput?.value || '').toLowerCase().trim();

    const filtered = searchTerm
        ? contacts.filter(j => `${j.prenom} ${j.nom}`.toLowerCase().includes(searchTerm))
        : contacts;

    if (filtered.length === 0) {
        container.innerHTML = '<div class="msg-contacts-empty">Aucun contact trouvé</div>';
        return;
    }

    let html = '';
    for (const j of filtered) {
        const lastMsg = lastMsgMap[j.id];
        const unread = state.msgUnreadCounts[j.id] || 0;
        const isActive = j.id === state.msgSelectedJeuneId;
        const initials = (j.prenom?.[0] || '') + (j.nom?.[0] || '');
        const preview = lastMsg
            ? (lastMsg.expediteur === 'admin' ? 'Vous : ' : '') + lastMsg.contenu.substring(0, 40)
            : 'Aucun message';
        const time = lastMsg ? formatMsgTime(lastMsg.created_at) : '';

        html += `
            <div class="msg-contact${isActive ? ' active' : ''}" data-jeune-id="${j.id}">
                <div class="msg-contact-avatar">${escapeHtml(initials.toUpperCase())}</div>
                <div class="msg-contact-info">
                    <div class="msg-contact-name">${escapeHtml(j.prenom)} ${escapeHtml(j.nom)}</div>
                    <div class="msg-contact-preview">${escapeHtml(preview)}</div>
                </div>
                <div class="msg-contact-meta">
                    ${time ? `<span class="msg-contact-time">${escapeHtml(time)}</span>` : ''}
                    ${unread > 0 ? '<span class="msg-unread-dot"></span>' : ''}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;

    container.querySelectorAll('.msg-contact').forEach(el => {
        el.addEventListener('click', () => {
            selectConversation(el.dataset.jeuneId);
        });
    });
}

function formatMsgTime(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Hier';
    } else if (diffDays < 7) {
        return ADMIN_CONFIG.dayNamesFull[d.getDay()];
    }
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatMsgFullTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatMsgDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

async function selectConversation(jeuneId) {
    state.msgSelectedJeuneId = jeuneId;

    document.querySelectorAll('.msg-contact').forEach(el => {
        el.classList.toggle('active', el.dataset.jeuneId === jeuneId);
    });

    document.getElementById('msg-chat-empty').classList.add('hidden');
    document.getElementById('msg-chat-active').classList.remove('hidden');

    const jeune = state.jeunes.find(j => j.id === jeuneId);
    if (!jeune) return;

    document.getElementById('msg-chat-header').innerHTML = `
        <div class="msg-contact-avatar" style="width:36px;height:36px;font-size:0.8rem">
            ${escapeHtml(((jeune.prenom?.[0] || '') + (jeune.nom?.[0] || '')).toUpperCase())}
        </div>
        <div>
            <div class="msg-chat-header-name">${escapeHtml(jeune.prenom)} ${escapeHtml(jeune.nom)}</div>
            <div class="msg-chat-header-status">${jeune.age} ans · ${escapeHtml(jeune.email)}</div>
        </div>
    `;

    await loadConversation(jeuneId);
    await markMessagesAsRead(jeuneId);
    renderMessages();
}

function renderMessages() {
    const container = document.getElementById('msg-chat-messages');
    if (state.msgMessages.length === 0) {
        container.innerHTML = '<div class="msg-contacts-empty" style="margin:auto">Aucun message pour l\'instant. Envoyez le premier !</div>';
        return;
    }

    let html = '';
    let lastDate = '';

    for (const msg of state.msgMessages) {
        const msgDate = new Date(msg.created_at).toDateString();
        if (msgDate !== lastDate) {
            lastDate = msgDate;
            html += `<div class="msg-date-separator">${formatMsgDate(msg.created_at)}</div>`;
        }

        const isAdmin = msg.expediteur === 'admin';
        html += `
            <div class="msg-bubble ${isAdmin ? 'msg-bubble-admin' : 'msg-bubble-jeune'}">
                ${escapeHtml(msg.contenu)}
                <span class="msg-bubble-time">${formatMsgFullTime(msg.created_at)}</span>
            </div>
        `;
    }

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function initMessagerieEvents() {
    document.getElementById('msg-send-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('msg-input');
        const content = input.value.trim();
        if (!content || !state.msgSelectedJeuneId) return;

        input.value = '';
        input.style.height = 'auto';

        try {
            await sendMessage(state.msgSelectedJeuneId, content);
            await loadConversation(state.msgSelectedJeuneId);
            renderMessages();
            const allMessages = await loadMsgLastMessages();
            const lastMsgMap = {};
            for (const m of allMessages) {
                if (!lastMsgMap[m.jeune_id]) lastMsgMap[m.jeune_id] = m;
            }
            const acceptedJeunes = state.jeunes.filter(j => j.statut === 'accepte');
            const jeunesWithMessages = state.jeunes.filter(j => lastMsgMap[j.id]);
            const jeunesWithoutMessages = acceptedJeunes.filter(j => !lastMsgMap[j.id]);
            const sortedContacts = [
                ...jeunesWithMessages.sort((a, b) => new Date(lastMsgMap[b.id]?.created_at || 0) - new Date(lastMsgMap[a.id]?.created_at || 0)),
                ...jeunesWithoutMessages.sort((a, b) => a.prenom.localeCompare(b.prenom)),
            ];
            renderMsgContacts(sortedContacts, lastMsgMap);
        } catch (err) {
            console.error('Send message error:', err);
        }
    });

    const input = document.getElementById('msg-input');
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('msg-send-form').requestSubmit();
        }
    });

    document.getElementById('msg-search').addEventListener('input', async () => {
        const allMessages = await loadMsgLastMessages();
        const lastMsgMap = {};
        for (const m of allMessages) {
            if (!lastMsgMap[m.jeune_id]) lastMsgMap[m.jeune_id] = m;
        }
        const acceptedJeunes = state.jeunes.filter(j => j.statut === 'accepte');
        const jeunesWithMessages = state.jeunes.filter(j => lastMsgMap[j.id]);
        const jeunesWithoutMessages = acceptedJeunes.filter(j => !lastMsgMap[j.id]);
        const sortedContacts = [
            ...jeunesWithMessages.sort((a, b) => new Date(lastMsgMap[b.id]?.created_at || 0) - new Date(lastMsgMap[a.id]?.created_at || 0)),
            ...jeunesWithoutMessages.sort((a, b) => a.prenom.localeCompare(b.prenom)),
        ];
        renderMsgContacts(sortedContacts, lastMsgMap);
    });
}

// ==================== MODAL ====================
function openModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const firstInput = document.querySelector('#modal-body input, #modal-body select, #modal-body textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.body.style.overflow = '';
}

function showConfirm(message, onConfirm) {
    const html = `
        <div class="confirm-content">
            <p>${escapeHtml(message)}</p>
            <div class="confirm-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-danger" id="confirm-yes">Confirmer</button>
            </div>
        </div>
    `;
    openModal('Confirmation', html);
    document.getElementById('confirm-yes').addEventListener('click', () => {
        onConfirm();
    });
}

// ==================== INIT ====================
function initEventListeners() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        login(email, password);
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(item.dataset.view);
        });
    });

    // Planning nav
    document.getElementById('prev-week').addEventListener('click', () => navigateWeek(-1));
    document.getElementById('next-week').addEventListener('click', () => navigateWeek(1));
    document.getElementById('today-btn').addEventListener('click', goToToday);

    // Add event button
    document.getElementById('add-event-btn').addEventListener('click', () => openEventForm(null));

    // Add vehicule buttons
    document.getElementById('add-vehicule-btn').addEventListener('click', () => openVehiculeForm(null));
    document.getElementById('empty-add-vehicule')?.addEventListener('click', () => {
        switchView('vehicules');
        openVehiculeForm(null);
    });

    // Modal close
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Village filters
    document.getElementById('villages-filters').addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        document.querySelectorAll('#villages-filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.villageFilter = btn.dataset.filter;
        renderVillages();
    });

    // Jeune filters
    document.getElementById('jeunes-filters').addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        document.querySelectorAll('#jeunes-filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.jeuneFilter = btn.dataset.filter;
        renderJeunes();
    });

    // Prospection
    document.getElementById('prospection-refresh-btn').addEventListener('click', async () => {
        await loadProspection();
        renderProspection();
        updateBadges();
    });
    document.getElementById('prospection-add-btn').addEventListener('click', openManualProspectionForm);
    document.getElementById('prospection-scan-btn').addEventListener('click', () => runProspectionScan());
    document.getElementById('prospection-draw-btn').addEventListener('click', () => {
        setProspectionDrawing(!state.prospectionDrawing);
    });
    document.getElementById('prospection-delete-point-btn').addEventListener('click', deleteSelectedProspectionPoint);
    document.getElementById('prospection-clear-zone-btn').addEventListener('click', clearProspectionDraftZone);
    document.getElementById('prospection-save-zone-btn').addEventListener('click', saveDraftAreaAndRunScan);
    document.getElementById('prospection-search').addEventListener('input', (e) => {
        state.prospectionSearch = e.target.value;
        renderProspection();
    });
    document.getElementById('prospection-dept-filter').addEventListener('change', (e) => {
        state.prospectionDeptFilter = e.target.value;
        renderProspection();
    });
    document.querySelectorAll('input[name="prospection-source"]').forEach(input => {
        input.addEventListener('change', () => {
            state.prospectionInfoSources = getSelectedProspectionInfoSources();
        });
    });
    document.getElementById('prospection-filters').addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        document.querySelectorAll('#prospection-filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.prospectionFilter = btn.dataset.filter;
        renderProspection();
    });

    // Messagerie
    initMessagerieEvents();
}

async function init() {
    if (!initSupabase()) {
        document.getElementById('login-error').textContent = 'Erreur de chargement. Rechargez la page.';
        return;
    }
    initEventListeners();
    await checkSession();
}

document.addEventListener('DOMContentLoaded', init);
