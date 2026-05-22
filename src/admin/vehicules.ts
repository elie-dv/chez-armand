import type { AppSupabaseClient } from '../types/database';
import type { Jeune } from './jeunes';

export type Vehicule = {
  id: string;
  nom: string;
  type: string;
  description: string | null;
  couleur: string;
  actif: boolean;
  created_at: string;
};

export type EquipeMembre = {
  id: string;
  vehicule_id: string;
  jeune_id: string;
  jeunes?: Pick<Jeune, 'id' | 'prenom' | 'nom' | 'age'> | null;
};

type EquipeMembreRow = Omit<EquipeMembre, 'jeunes'> & {
  jeunes?: EquipeMembre['jeunes'] | EquipeMembre['jeunes'][];
};

export type VehiculeFormData = {
  nom: string;
  type: string;
  description: string;
  couleur: string;
  actif: boolean;
};

export const emptyVehiculeForm: VehiculeFormData = {
  nom: '',
  type: 'van',
  description: '',
  couleur: '#8B4513',
  actif: true,
};

export async function loadVehicules(client: AppSupabaseClient): Promise<Vehicule[]> {
  const { data, error } = await client
    .from('vehicules')
    .select('*')
    .order('created_at');

  if (error) throw new Error(error.message);
  return (data || []) as Vehicule[];
}

export async function loadEquipeMembers(client: AppSupabaseClient, vehiculeId: string): Promise<EquipeMembre[]> {
  const { data, error } = await client
    .from('equipe_membres')
    .select('id, vehicule_id, jeune_id, jeunes(id, prenom, nom, age)')
    .eq('vehicule_id', vehiculeId);

  if (error) throw new Error(error.message);
  return ((data || []) as EquipeMembreRow[]).map((member) => ({
    ...member,
    jeunes: Array.isArray(member.jeunes) ? member.jeunes[0] || null : member.jeunes,
  })) as EquipeMembre[];
}

export async function loadEquipeByVehicle(client: AppSupabaseClient, vehicules: Vehicule[]) {
  const entries = await Promise.all(
    vehicules.map(async (vehicule) => [vehicule.id, await loadEquipeMembers(client, vehicule.id)] as const),
  );
  return Object.fromEntries(entries) as Record<string, EquipeMembre[]>;
}

export async function saveVehicule(
  client: AppSupabaseClient,
  data: VehiculeFormData,
  vehiculeId?: string,
) {
  const payload = {
    nom: data.nom.trim(),
    type: data.type,
    couleur: data.couleur,
    description: data.description.trim() || null,
    actif: data.actif,
  };

  const query = vehiculeId
    ? client.from('vehicules').update(payload).eq('id', vehiculeId)
    : client.from('vehicules').insert([payload]);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteVehicule(client: AppSupabaseClient, vehiculeId: string) {
  const { error } = await client.from('vehicules').delete().eq('id', vehiculeId);
  if (error) throw new Error(error.message);
}

export async function addEquipeMember(client: AppSupabaseClient, vehiculeId: string, jeuneId: string) {
  const { error } = await client.from('equipe_membres').insert([{ vehicule_id: vehiculeId, jeune_id: jeuneId }]);
  if (error) throw new Error(error.message);
}

export async function removeEquipeMember(client: AppSupabaseClient, memberId: string) {
  const { error } = await client.from('equipe_membres').delete().eq('id', memberId);
  if (error) throw new Error(error.message);
}

export function formFromVehicule(vehicule: Vehicule): VehiculeFormData {
  return {
    nom: vehicule.nom,
    type: vehicule.type,
    description: vehicule.description || '',
    couleur: vehicule.couleur || '#8B4513',
    actif: vehicule.actif !== false,
  };
}
