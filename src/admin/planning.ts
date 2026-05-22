import type { AppSupabaseClient } from '../types/database';
import type { Vehicule } from './vehicules';
import type { Village } from './villages';

export type EventStatus = 'planifie' | 'confirme' | 'en_cours' | 'termine' | 'annule';

export type PlanningEvent = {
  id: string;
  vehicule_id: string | null;
  village_id: string | null;
  titre: string;
  lieu: string;
  date_debut: string;
  date_fin: string;
  nb_personnes_prevu: number | null;
  statut: EventStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EventFormData = {
  titre: string;
  vehicule_id: string;
  statut: EventStatus;
  lieu: string;
  date_debut: string;
  date_fin: string;
  nb_personnes_prevu: number | null;
  village_id: string;
  notes: string;
};

export const eventStatusLabels: Record<EventStatus, string> = {
  planifie: 'Planifié',
  confirme: 'Confirmé',
  en_cours: 'En cours',
  termine: 'Terminé',
  annule: 'Annulé',
};

export const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
export const monthNames = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(d: Date, n: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

export function formatDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateFr(d: Date) {
  return `${d.getDate()} ${monthNames[d.getMonth()]}`;
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isEventOnDay(evt: PlanningEvent, day: Date) {
  const dayStr = formatDate(day);
  return evt.date_debut <= dayStr && evt.date_fin >= dayStr;
}

export async function loadEvents(client: AppSupabaseClient, weekStart: Date): Promise<PlanningEvent[]> {
  const start = formatDate(weekStart);
  const end = formatDate(addDays(weekStart, 6));
  const { data, error } = await client
    .from('evenements')
    .select('*')
    .lte('date_debut', end)
    .gte('date_fin', start)
    .order('date_debut');

  if (error) throw new Error(error.message);
  return (data || []) as PlanningEvent[];
}

export async function saveEvent(client: AppSupabaseClient, data: EventFormData, eventId?: string) {
  const payload = {
    titre: data.titre.trim(),
    vehicule_id: data.vehicule_id || null,
    statut: data.statut,
    lieu: data.lieu.trim(),
    date_debut: data.date_debut,
    date_fin: data.date_fin,
    nb_personnes_prevu: data.nb_personnes_prevu || null,
    village_id: data.village_id || null,
    notes: data.notes.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const query = eventId
    ? client.from('evenements').update(payload).eq('id', eventId)
    : client.from('evenements').insert([payload]);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteEvent(client: AppSupabaseClient, eventId: string) {
  const { error } = await client.from('evenements').delete().eq('id', eventId);
  if (error) throw new Error(error.message);
}

export function emptyEventForm(date = formatDate(new Date()), vehiculeId = ''): EventFormData {
  return {
    titre: '',
    vehicule_id: vehiculeId,
    statut: 'planifie',
    lieu: '',
    date_debut: date,
    date_fin: date,
    nb_personnes_prevu: null,
    village_id: '',
    notes: '',
  };
}

export function formFromEvent(event: PlanningEvent): EventFormData {
  return {
    titre: event.titre,
    vehicule_id: event.vehicule_id || '',
    statut: event.statut || 'planifie',
    lieu: event.lieu,
    date_debut: event.date_debut,
    date_fin: event.date_fin,
    nb_personnes_prevu: event.nb_personnes_prevu,
    village_id: event.village_id || '',
    notes: event.notes || '',
  };
}

export function formFromVillage(village: Village, vehicules: Vehicule[]): EventFormData {
  return {
    titre: `Fête à ${village.nom}`,
    vehicule_id: vehicules.find((vehicule) => vehicule.actif)?.id || '',
    statut: 'planifie',
    lieu: `${village.nom} (${village.code_postal})`,
    date_debut: village.date_souhaitee || formatDate(new Date()),
    date_fin: village.date_souhaitee || formatDate(new Date()),
    nb_personnes_prevu: village.nombre_habitants,
    village_id: village.id,
    notes: '',
  };
}
