import type { AppSupabaseClient } from '../types/database';

export type JeuneStatus = 'all' | 'nouveau' | 'accepte' | 'refuse';

export type Jeune = {
  id: string;
  prenom: string;
  nom: string;
  age: number;
  email: string;
  telephone: string;
  motivation: string;
  statut: Exclude<JeuneStatus, 'all'> | null;
  created_at: string;
};

export const jeuneStatusLabels: Record<Exclude<JeuneStatus, 'all'>, string> = {
  nouveau: 'Nouveau',
  accepte: 'Accepté',
  refuse: 'Refusé',
};

export const jeuneFilters: Array<{ label: string; value: JeuneStatus }> = [
  { label: 'Toutes', value: 'all' },
  { label: 'Nouvelles', value: 'nouveau' },
  { label: 'Acceptées', value: 'accepte' },
  { label: 'Refusées', value: 'refuse' },
];

export async function loadJeunes(client: AppSupabaseClient): Promise<Jeune[]> {
  const { data, error } = await client
    .from('jeunes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as Jeune[];
}

export async function updateJeuneStatus(
  client: AppSupabaseClient,
  id: string,
  statut: Exclude<JeuneStatus, 'all'>,
) {
  const { error } = await client.from('jeunes').update({ statut }).eq('id', id);
  if (error) throw new Error(error.message);
}
