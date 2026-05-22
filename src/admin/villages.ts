import type { AppSupabaseClient } from '../types/database';

export type VillageStatus = 'all' | 'nouveau' | 'contacte' | 'accepte' | 'refuse';

export type Village = {
  id: string;
  nom: string;
  code_postal: string;
  nombre_habitants: number;
  contact_nom: string;
  contact_email: string;
  contact_telephone: string;
  date_souhaitee: string | null;
  message: string | null;
  statut: Exclude<VillageStatus, 'all'> | null;
  created_at: string;
};

export const villageStatusLabels: Record<Exclude<VillageStatus, 'all'>, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  accepte: 'Accepté',
  refuse: 'Refusé',
};

export const villageFilters: Array<{ label: string; value: VillageStatus }> = [
  { label: 'Toutes', value: 'all' },
  { label: 'Nouvelles', value: 'nouveau' },
  { label: 'Contactées', value: 'contacte' },
  { label: 'Acceptées', value: 'accepte' },
  { label: 'Refusées', value: 'refuse' },
];

export async function loadVillages(client: AppSupabaseClient): Promise<Village[]> {
  const { data, error } = await client
    .from('villages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as Village[];
}

export async function updateVillageStatus(
  client: AppSupabaseClient,
  id: string,
  statut: Exclude<VillageStatus, 'all'>,
) {
  const { error } = await client.from('villages').update({ statut }).eq('id', id);
  if (error) throw new Error(error.message);
}

export function formatVillageDate(value: string | null) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR');
}

export function eventDefaultsFromVillage(village: Village) {
  return {
    titre: `Fête à ${village.nom}`,
    lieu: `${village.nom} (${village.code_postal})`,
    date_debut: village.date_souhaitee || '',
    date_fin: village.date_souhaitee || '',
    nb_personnes_prevu: village.nombre_habitants,
    village_id: village.id,
  };
}
