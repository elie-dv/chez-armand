import type { AppSupabaseClient, TableName } from '../types/database';
import type { AdminBadges, AdminMetric } from './types';

const emptyBadges: AdminBadges = {
  villages: 0,
  prospection: 0,
  jeunes: 0,
  messagerie: 0,
};

async function readCount(query: PromiseLike<{ count: number | null; error: { message: string } | null }>, table: TableName) {
  const { count, error } = await query;
  if (error) {
    console.warn(`Unable to count ${table}:`, error.message);
    return 0;
  }

  return count || 0;
}

async function countQuery(client: AppSupabaseClient, table: TableName): Promise<number> {
  const query = client.from(table).select('*', { count: 'exact', head: true });
  return readCount(query, table);
}

async function countEquals(client: AppSupabaseClient, table: TableName, column: string, value: string | boolean) {
  const query = client.from(table).select('*', { count: 'exact', head: true }).eq(column, value);
  return readCount(query, table);
}

async function countIn(client: AppSupabaseClient, table: TableName, column: string, values: string[]) {
  const query = client.from(table).select('*', { count: 'exact', head: true }).in(column, values);
  return readCount(query, table);
}

export async function loadAdminBadges(client: AppSupabaseClient): Promise<AdminBadges> {
  const [villages, jeunes, prospection] = await Promise.all([
    countEquals(client, 'villages', 'statut', 'nouveau'),
    countEquals(client, 'jeunes', 'statut', 'nouveau'),
    countIn(client, 'prospection_records', 'statut', ['to_review', 'ready_to_contact', 'to_call', 'follow_up_needed']),
  ]);

  return {
    ...emptyBadges,
    villages,
    jeunes,
    prospection,
  };
}

export async function loadAdminMetrics(client: AppSupabaseClient): Promise<AdminMetric[]> {
  const [vehicules, evenements, villages, jeunes, prospection] = await Promise.all([
    countEquals(client, 'vehicules', 'actif', true),
    countQuery(client, 'evenements'),
    countQuery(client, 'villages'),
    countQuery(client, 'jeunes'),
    countQuery(client, 'prospection_records'),
  ]);

  return [
    { label: 'Véhicules actifs', value: vehicules, helper: 'Planning et tournées' },
    { label: 'Événements', value: evenements, helper: 'Historique et agenda' },
    { label: 'Villages', value: villages, helper: 'Demandes reçues' },
    { label: 'Jeunes', value: jeunes, helper: 'Candidatures' },
    { label: 'Prospection', value: prospection, helper: 'Communes candidates' },
  ];
}
