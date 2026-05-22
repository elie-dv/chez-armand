import type { SupabaseClient } from '@supabase/supabase-js';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type BaseRow = {
  id: string;
  created_at: string;
};

type WithUpdatedAt = {
  updated_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      villages: Table<
        BaseRow & {
          nom: string;
          code_postal: string;
          nombre_habitants: number;
          contact_nom: string;
          contact_email: string;
          contact_telephone: string;
          date_souhaitee: string | null;
          message: string | null;
          statut: string | null;
        },
        {
          nom: string;
          code_postal: string;
          nombre_habitants: number;
          contact_nom: string;
          contact_email: string;
          contact_telephone: string;
          date_souhaitee?: string | null;
          message?: string | null;
          statut?: string | null;
        }
      >;
      jeunes: Table<
        BaseRow & {
          prenom: string;
          nom: string;
          age: number;
          email: string;
          telephone: string;
          motivation: string;
          statut: string | null;
        },
        {
          prenom: string;
          nom: string;
          age: number;
          email: string;
          telephone: string;
          motivation: string;
          statut?: string | null;
        }
      >;
      vehicules: Table<
        BaseRow & {
          nom: string;
          type: string;
          description: string | null;
          couleur: string;
          actif: boolean;
        },
        {
          nom: string;
          type?: string;
          description?: string | null;
          couleur?: string;
          actif?: boolean;
        }
      >;
      equipe_membres: Table<
        BaseRow & {
          vehicule_id: string;
          jeune_id: string;
        },
        {
          vehicule_id: string;
          jeune_id: string;
        }
      >;
      evenements: Table<
        BaseRow &
          WithUpdatedAt & {
            vehicule_id: string | null;
            village_id: string | null;
            titre: string;
            lieu: string;
            date_debut: string;
            date_fin: string;
            nb_personnes_prevu: number | null;
            statut: string;
            notes: string | null;
          },
        {
          vehicule_id?: string | null;
          village_id?: string | null;
          titre: string;
          lieu: string;
          date_debut: string;
          date_fin: string;
          nb_personnes_prevu?: number | null;
          statut?: string;
          notes?: string | null;
          updated_at?: string;
        }
      >;
      messages: Table<
        BaseRow & {
          jeune_id: string;
          contenu: string;
          expediteur: string;
          lu: boolean;
        },
        {
          jeune_id: string;
          contenu: string;
          expediteur: string;
          lu?: boolean;
        }
      >;
      prospection_areas: Table<
        BaseRow &
          WithUpdatedAt & {
            nom: string;
            type: string;
            config: Json;
            statut: string;
            last_scan_at: string | null;
            last_scan_error: string | null;
          },
        {
          nom: string;
          type?: string;
          config?: Json;
          statut?: string;
          last_scan_at?: string | null;
          last_scan_error?: string | null;
          updated_at?: string;
        }
      >;
      municipalities: Table<
        BaseRow &
          WithUpdatedAt & {
            insee_code: string;
            nom: string;
            code_postal: string | null;
            department_code: string;
            population: number | null;
            latitude: number | null;
            longitude: number | null;
            geojson: Json | null;
            population_source: string | null;
          },
        {
          insee_code: string;
          nom: string;
          code_postal?: string | null;
          department_code: string;
          population?: number | null;
          latitude?: number | null;
          longitude?: number | null;
          geojson?: Json | null;
          population_source?: string | null;
          updated_at?: string;
        }
      >;
      municipality_enrichments: Table<
        WithUpdatedAt & {
          municipality_id: string;
          mairie_email: string | null;
          mairie_phone: string | null;
          mairie_opening_hours: string | null;
          mairie_website: string | null;
          contact_source: string | null;
          contact_checked_at: string | null;
          commerce_count: number | null;
          commerce_tags: Json;
          commerce_source: string | null;
          commerce_checked_at: string | null;
          commerce_confidence: string | null;
        },
        {
          municipality_id: string;
          mairie_email?: string | null;
          mairie_phone?: string | null;
          mairie_opening_hours?: string | null;
          mairie_website?: string | null;
          contact_source?: string | null;
          contact_checked_at?: string | null;
          commerce_count?: number | null;
          commerce_tags?: Json;
          commerce_source?: string | null;
          commerce_checked_at?: string | null;
          commerce_confidence?: string | null;
          updated_at?: string;
        }
      >;
      prospection_records: Table<
        BaseRow &
          WithUpdatedAt & {
            municipality_id: string;
            area_id: string | null;
            statut: string;
            notes: string | null;
            last_contacted_at: string | null;
            next_action_at: string | null;
          },
        {
          municipality_id: string;
          area_id?: string | null;
          statut?: string;
          notes?: string | null;
          last_contacted_at?: string | null;
          next_action_at?: string | null;
          updated_at?: string;
        }
      >;
      prospection_scan_jobs: Table<
        BaseRow &
          WithUpdatedAt & {
            area_id: string;
            statut: string;
            candidate_codes: Json;
            candidate_communes: Json;
            total_candidates: number;
            processed_candidates: number;
            saved_count: number;
            skipped_count: number;
            error_count: number;
            last_error: string | null;
            created_by: string | null;
            started_at: string | null;
            completed_at: string | null;
          }
      >;
      prospection_emails: Table<
        BaseRow & {
          municipality_id: string;
          prospection_record_id: string | null;
          recipient_email: string;
          subject: string;
          body: string;
          statut: string;
          provider: string | null;
          provider_message_id: string | null;
          provider_thread_id: string | null;
          error_message: string | null;
          sent_at: string | null;
          reply_message_id: string | null;
          reply_detected_at: string | null;
          reply_from: string | null;
          reply_subject: string | null;
          reply_snippet: string | null;
          attachments: Json;
          created_by: string | null;
        },
        {
          municipality_id: string;
          prospection_record_id?: string | null;
          recipient_email: string;
          subject: string;
          body: string;
          statut?: string;
          provider?: string | null;
          provider_message_id?: string | null;
          provider_thread_id?: string | null;
          error_message?: string | null;
          sent_at?: string | null;
          reply_message_id?: string | null;
          reply_detected_at?: string | null;
          reply_from?: string | null;
          reply_subject?: string | null;
          reply_snippet?: string | null;
          attachments?: Json;
          created_by?: string | null;
        }
      >;
      municipality_researches: Table<
        BaseRow & {
          municipality_id: string;
          statut: string;
          summary: string | null;
          sources: Json;
          error_message: string | null;
          completed_at: string | null;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type AppSupabaseClient = SupabaseClient<Database>;
export type TableName = keyof Database['public']['Tables'];
