import type { AppSupabaseClient } from '../types/database';

export type ProspectionStatus =
  | 'to_review'
  | 'ready_to_contact'
  | 'email_previewed'
  | 'email_sent'
  | 'to_call'
  | 'called'
  | 'follow_up_needed'
  | 'replied'
  | 'interested'
  | 'not_interested'
  | 'do_not_contact';

export type Municipality = {
  id: string;
  insee_code: string;
  nom: string;
  code_postal: string | null;
  department_code: string;
  population: number | null;
  latitude: number | null;
  longitude: number | null;
};

export type MunicipalityEnrichment = {
  municipality_id: string;
  mairie_email: string | null;
  mairie_phone: string | null;
  mairie_opening_hours: string | null;
  mairie_website: string | null;
  contact_source: string | null;
  commerce_count: number | null;
  commerce_source: string | null;
};

export type ProspectionRecord = {
  id: string;
  municipality_id: string;
  area_id: string | null;
  statut: ProspectionStatus;
  notes: string | null;
  last_contacted_at: string | null;
  next_action_at: string | null;
  created_at: string;
  updated_at: string;
  municipality: Municipality;
  enrichment: Partial<MunicipalityEnrichment>;
};

export type ScanArea = { id: string };

export type ScanResult = {
  job_id: string;
  has_more?: boolean;
  progress?: number;
  processed_candidates?: number;
  total_candidates?: number;
  saved_count?: number;
};

export type ReplySyncResult = {
  checked: number;
  updated: number;
  errors: string[];
};

export const prospectionStatusLabels: Record<ProspectionStatus, string> = {
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
};

export const prospectionFilters: Array<{ label: string; value: 'all' | ProspectionStatus }> = [
  { label: 'Toutes', value: 'all' },
  { label: 'À qualifier', value: 'to_review' },
  { label: 'Prêtes', value: 'ready_to_contact' },
  { label: 'Emails envoyés', value: 'email_sent' },
  { label: 'À appeler', value: 'to_call' },
  { label: 'Intéressées', value: 'interested' },
];

export const departmentFilters = [
  { label: 'Tous les départements', value: 'all' },
  { label: 'Côtes-d’Armor', value: '22' },
  { label: 'Ille-et-Vilaine', value: '35' },
  { label: 'Morbihan', value: '56' },
];

export const prospectionEmailTemplate = {
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
};

export async function loadProspection(client: AppSupabaseClient): Promise<ProspectionRecord[]> {
  const { data: records, error } = await client
    .from('prospection_records')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);

  const municipalityIds = ((records || []) as Array<{ municipality_id: string }>).map((record) => record.municipality_id);
  if (municipalityIds.length === 0) return [];

  const [{ data: municipalities, error: municipalitiesError }, { data: enrichments, error: enrichmentsError }] =
    await Promise.all([
      client.from('municipalities').select('*').in('id', municipalityIds),
      client.from('municipality_enrichments').select('*').in('municipality_id', municipalityIds),
    ]);
  if (municipalitiesError) throw new Error(municipalitiesError.message);
  if (enrichmentsError) throw new Error(enrichmentsError.message);

  const municipalitiesById = Object.fromEntries(((municipalities || []) as Municipality[]).map((item) => [item.id, item]));
  const enrichmentsById = Object.fromEntries(
    ((enrichments || []) as MunicipalityEnrichment[]).map((item) => [item.municipality_id, item]),
  );

  return ((records || []) as ProspectionRecord[])
    .map((record) => ({
      ...record,
      municipality: municipalitiesById[record.municipality_id],
      enrichment: enrichmentsById[record.municipality_id] || {},
    }))
    .filter((record) => record.municipality);
}

export async function updateProspectionRecord(
  client: AppSupabaseClient,
  recordId: string,
  patch: Partial<Pick<ProspectionRecord, 'statut' | 'notes' | 'next_action_at' | 'last_contacted_at'>>,
) {
  const { error } = await client
    .from('prospection_records')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', recordId);
  if (error) throw new Error(error.message);
}

export type ManualProspectionInput = {
  nom: string;
  insee_code: string;
  code_postal: string;
  department_code: string;
  population: number | null;
  latitude: number | null;
  longitude: number | null;
  commerce_count: number | null;
  mairie_email: string;
  mairie_phone: string;
  mairie_opening_hours: string;
  statut: ProspectionStatus;
  next_action_at: string;
  notes: string;
};

export function emptyManualProspection(): ManualProspectionInput {
  return {
    nom: '',
    insee_code: '',
    code_postal: '',
    department_code: '',
    population: null,
    latitude: null,
    longitude: null,
    commerce_count: null,
    mairie_email: '',
    mairie_phone: '',
    mairie_opening_hours: '',
    statut: 'ready_to_contact',
    next_action_at: '',
    notes: '',
  };
}

export async function saveManualProspection(client: AppSupabaseClient, input: ManualProspectionInput) {
  const now = new Date().toISOString();
  const { data: municipalityRows, error: municipalityError } = await client
    .from('municipalities')
    .upsert([{
      insee_code: input.insee_code.trim(),
      nom: input.nom.trim(),
      code_postal: input.code_postal.trim() || null,
      department_code: input.department_code,
      population: input.population,
      latitude: input.latitude,
      longitude: input.longitude,
      population_source: 'manual',
      updated_at: now,
    }], { onConflict: 'insee_code' })
    .select('*')
    .limit(1);
  if (municipalityError) throw new Error(municipalityError.message);

  const municipality = municipalityRows?.[0] as Municipality | undefined;
  if (!municipality) throw new Error('Commune non créée.');

  const { error: enrichmentError } = await client
    .from('municipality_enrichments')
    .upsert([{
      municipality_id: municipality.id,
      mairie_email: input.mairie_email.trim() || null,
      mairie_phone: input.mairie_phone.trim() || null,
      mairie_opening_hours: input.mairie_opening_hours.trim() || null,
      contact_source: 'manual',
      contact_checked_at: now,
      commerce_count: input.commerce_count,
      commerce_source: 'manual',
      commerce_checked_at: now,
      commerce_confidence: 'verified',
      updated_at: now,
    }], { onConflict: 'municipality_id' });
  if (enrichmentError) throw new Error(enrichmentError.message);

  const { error: recordError } = await client
    .from('prospection_records')
    .upsert([{
      municipality_id: municipality.id,
      statut: input.statut,
      notes: input.notes.trim() || null,
      next_action_at: input.next_action_at || null,
      updated_at: now,
    }], { onConflict: 'municipality_id' });
  if (recordError) throw new Error(recordError.message);
}

export function buildProspectionEmail(item: ProspectionRecord) {
  const commune = item.municipality.nom;
  return {
    recipient_email: item.enrichment.mairie_email || '',
    subject: prospectionEmailTemplate.subject.replaceAll('{commune}', commune),
    body: prospectionEmailTemplate.body.replaceAll('{commune}', commune),
  };
}

export async function sendProspectionEmail(
  client: AppSupabaseClient,
  item: ProspectionRecord,
  payload: { recipient_email: string; subject: string; body: string },
) {
  const { data: { session } } = await client.auth.getSession();
  if (!session?.user) throw new Error('Session admin expirée.');

  const { data: emailRows, error: insertError } = await client
    .from('prospection_emails')
    .insert([{
      municipality_id: item.municipality_id,
      prospection_record_id: item.id,
      recipient_email: payload.recipient_email,
      subject: payload.subject,
      body: payload.body,
      statut: 'queued',
      created_by: session.user.id,
    }])
    .select('*')
    .limit(1);
  if (insertError) throw new Error(insertError.message);

  const email = emailRows?.[0];
  if (!email) throw new Error('Brouillon email non créé.');

  const result = await callAdminFunction<{ message_id?: string; thread_id?: string }>(client, 'send-prospection-email', {
    email_id: email.id,
  });

  await updateProspectionRecord(client, item.id, {
    statut: 'email_sent',
    last_contacted_at: new Date().toISOString(),
  });

  return result;
}

export async function syncGmailReplies(client: AppSupabaseClient) {
  return await callAdminFunction<ReplySyncResult>(client, 'sync-gmail-replies', {
    limit: 75,
  }, 90_000);
}

function readErrorMessage(value: unknown) {
  return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
    ? value.error
    : null;
}

export async function callAdminFunction<T = unknown>(
  client: AppSupabaseClient,
  name: string,
  payload: unknown,
  timeoutMs = 60_000,
): Promise<T | null> {
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) throw new Error('Session admin expirée.');

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Configuration Supabase manquante.');

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!response.ok) throw new Error(readErrorMessage(json) || text || `Erreur HTTP ${response.status}`);
    return json as T | null;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`La fonction ${name} ne répond pas après ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function createInitialProspectionArea(client: AppSupabaseClient, mairieSources: string[]): Promise<ScanArea> {
  const area = {
    nom: 'Bretagne initiale - 22/35/56',
    type: 'departments',
    config: {
      department_codes: ['22', '35', '56'],
      population_max: 500,
      commerce_max: 2,
      commerce_source: 'openstreetmap',
      mairie_sources: mairieSources,
    },
  };

  const { data: existingAreas, error: existingError } = await client
    .from('prospection_areas')
    .select('*')
    .eq('nom', area.nom)
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if (existingAreas?.[0]) return existingAreas[0] as ScanArea;

  const { data: insertedAreas, error: insertError } = await client
    .from('prospection_areas')
    .insert([area])
    .select('*')
    .limit(1);
  if (insertError) throw new Error(insertError.message);
  if (!insertedAreas?.[0]) throw new Error('Zone de prospection non créée.');
  return insertedAreas[0] as ScanArea;
}

export async function createPolygonProspectionArea(
  client: AppSupabaseClient,
  name: string,
  points: Array<{ lat: number; lng: number }>,
  mairieSources: string[],
) : Promise<ScanArea> {
  if (points.length < 3) throw new Error('Ajoutez au moins 3 points pour définir une zone.');

  const polygon = points.map((point) => [point.lng, point.lat]);
  polygon.push([points[0].lng, points[0].lat]);

  const { data, error } = await client
    .from('prospection_areas')
    .insert([{
      nom: name.trim() || 'Zone personnalisée',
      type: 'polygon',
      config: {
        geometry: {
          type: 'Polygon',
          coordinates: [polygon],
        },
        population_max: 500,
        commerce_max: 2,
        commerce_source: 'openstreetmap',
        mairie_sources: mairieSources,
      },
      statut: 'ready',
    }])
    .select('*')
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data?.[0]) throw new Error('Zone de prospection non créée.');
  return data[0] as ScanArea;
}
