import type { AppSupabaseClient } from '../types/database';
import type { Jeune } from './jeunes';

export type Message = {
  id: string;
  jeune_id: string;
  contenu: string;
  expediteur: 'admin' | 'jeune';
  lu: boolean;
  created_at: string;
};

export async function loadUnreadCounts(client: AppSupabaseClient) {
  const { data, error } = await client
    .from('messages')
    .select('jeune_id')
    .eq('expediteur', 'jeune')
    .eq('lu', false);

  if (error) throw new Error(error.message);

  const counts: Record<string, number> = {};
  (data || []).forEach((message: { jeune_id: string }) => {
    counts[message.jeune_id] = (counts[message.jeune_id] || 0) + 1;
  });
  return counts;
}

export async function loadLastMessages(client: AppSupabaseClient): Promise<Message[]> {
  const { data, error } = await client
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as Message[];
}

export async function loadConversation(client: AppSupabaseClient, jeuneId: string): Promise<Message[]> {
  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('jeune_id', jeuneId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as Message[];
}

export async function markMessagesAsRead(client: AppSupabaseClient, jeuneId: string) {
  const { error } = await client
    .from('messages')
    .update({ lu: true })
    .eq('jeune_id', jeuneId)
    .eq('expediteur', 'jeune')
    .eq('lu', false);

  if (error) throw new Error(error.message);
}

export async function sendMessage(client: AppSupabaseClient, jeuneId: string, contenu: string) {
  const { error } = await client.from('messages').insert([{
    jeune_id: jeuneId,
    contenu: contenu.trim(),
    expediteur: 'admin',
    lu: true,
  }]);
  if (error) throw new Error(error.message);
}

export function buildContacts(jeunes: Jeune[], messages: Message[]) {
  const lastMsgMap: Record<string, Message> = {};
  for (const message of messages) {
    if (!lastMsgMap[message.jeune_id]) lastMsgMap[message.jeune_id] = message;
  }

  const acceptedJeunes = jeunes.filter((jeune) => jeune.statut === 'accepte');
  const jeunesWithMessages = jeunes.filter((jeune) => lastMsgMap[jeune.id]);
  const jeunesWithoutMessages = acceptedJeunes.filter((jeune) => !lastMsgMap[jeune.id]);

  const contacts = [
    ...jeunesWithMessages.sort((a, b) => {
      const ta = new Date(lastMsgMap[a.id]?.created_at || 0).getTime();
      const tb = new Date(lastMsgMap[b.id]?.created_at || 0).getTime();
      return tb - ta;
    }),
    ...jeunesWithoutMessages.sort((a, b) => a.prenom.localeCompare(b.prenom)),
  ];

  return { contacts, lastMsgMap };
}

export function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long' });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function formatMsgDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
