import { createClient } from '@supabase/supabase-js';
import type { AppSupabaseClient, Database } from '../types/database';

let client: AppSupabaseClient | null = null;

export function getSupabaseClient(): AppSupabaseClient | null {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  client = createClient<Database>(url, anonKey);
  return client;
}
