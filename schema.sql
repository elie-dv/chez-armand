-- Chez Armand Database Schema
-- Run this SQL in your Supabase SQL Editor

-- ==================== EXISTING TABLES ====================

CREATE TABLE IF NOT EXISTS villages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  code_postal TEXT NOT NULL,
  nombre_habitants INTEGER NOT NULL,
  contact_nom TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_telephone TEXT NOT NULL,
  date_souhaitee DATE,
  message TEXT,
  statut TEXT DEFAULT 'nouveau',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jeunes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  age INTEGER NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT NOT NULL,
  motivation TEXT NOT NULL,
  statut TEXT DEFAULT 'nouveau',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If tables already exist, add the statut column
ALTER TABLE villages ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'nouveau';
ALTER TABLE jeunes ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'nouveau';

-- ==================== BACK-OFFICE TABLES ====================

CREATE TABLE IF NOT EXISTS vehicules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'van',
  description TEXT,
  couleur TEXT DEFAULT '#8B4513',
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipe_membres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicule_id UUID NOT NULL REFERENCES vehicules(id) ON DELETE CASCADE,
  jeune_id UUID NOT NULL REFERENCES jeunes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(vehicule_id, jeune_id)
);

CREATE TABLE IF NOT EXISTS evenements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicule_id UUID REFERENCES vehicules(id) ON DELETE SET NULL,
  village_id UUID REFERENCES villages(id) ON DELETE SET NULL,
  titre TEXT NOT NULL,
  lieu TEXT NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  nb_personnes_prevu INTEGER,
  statut TEXT DEFAULT 'planifie'
    CHECK (statut IN ('planifie', 'confirme', 'en_cours', 'termine', 'annule')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== MESSAGERIE ====================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jeune_id UUID NOT NULL REFERENCES jeunes(id) ON DELETE CASCADE,
  contenu TEXT NOT NULL,
  expediteur TEXT NOT NULL CHECK (expediteur IN ('admin', 'jeune')),
  lu BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== PROSPECTION COMMUNES ====================

CREATE TABLE IF NOT EXISTS prospection_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'departments'
    CHECK (type IN ('departments', 'polygon', 'radius', 'manual')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  statut TEXT NOT NULL DEFAULT 'ready'
    CHECK (statut IN ('ready', 'scanning', 'completed', 'failed')),
  last_scan_at TIMESTAMP WITH TIME ZONE,
  last_scan_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS municipalities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insee_code TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  code_postal TEXT,
  department_code TEXT NOT NULL,
  population INTEGER,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  geojson JSONB,
  population_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS municipality_enrichments (
  municipality_id UUID PRIMARY KEY REFERENCES municipalities(id) ON DELETE CASCADE,
  mairie_email TEXT,
  mairie_phone TEXT,
  mairie_opening_hours TEXT,
  mairie_website TEXT,
  contact_source TEXT,
  contact_checked_at TIMESTAMP WITH TIME ZONE,
  commerce_count INTEGER,
  commerce_tags JSONB DEFAULT '[]'::jsonb,
  commerce_source TEXT DEFAULT 'openstreetmap',
  commerce_checked_at TIMESTAMP WITH TIME ZONE,
  commerce_confidence TEXT DEFAULT 'estimated'
    CHECK (commerce_confidence IN ('estimated', 'verified', 'low')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospection_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  area_id UUID REFERENCES prospection_areas(id) ON DELETE SET NULL,
  statut TEXT NOT NULL DEFAULT 'to_review'
    CHECK (statut IN (
      'to_review',
      'ready_to_contact',
      'email_previewed',
      'email_sent',
      'to_call',
      'called',
      'follow_up_needed',
      'replied',
      'interested',
      'not_interested',
      'do_not_contact'
    )),
  notes TEXT,
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  next_action_at DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(municipality_id)
);

CREATE TABLE IF NOT EXISTS prospection_scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES prospection_areas(id) ON DELETE CASCADE,
  statut TEXT NOT NULL DEFAULT 'queued'
    CHECK (statut IN ('queued', 'running', 'completed', 'failed')),
  candidate_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  candidate_communes JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_candidates INTEGER NOT NULL DEFAULT 0,
  processed_candidates INTEGER NOT NULL DEFAULT 0,
  saved_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospection_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  prospection_record_id UUID REFERENCES prospection_records(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'draft'
    CHECK (statut IN ('draft', 'queued', 'sent', 'failed')),
  provider TEXT DEFAULT 'gmail_smtp',
  provider_message_id TEXT,
  provider_thread_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  reply_message_id TEXT,
  reply_detected_at TIMESTAMP WITH TIME ZONE,
  reply_from TEXT,
  reply_subject TEXT,
  reply_snippet TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS municipality_researches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  statut TEXT NOT NULL DEFAULT 'queued'
    CHECK (statut IN ('queued', 'running', 'completed', 'failed')),
  summary TEXT,
  sources JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- ==================== ROW LEVEL SECURITY ====================

ALTER TABLE villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE jeunes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicules ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe_membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE evenements ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospection_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipality_enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospection_scan_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospection_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipality_researches ENABLE ROW LEVEL SECURITY;

-- Drop policies first so the script can be re-run safely
DROP POLICY IF EXISTS "Allow public inserts on villages" ON villages;
DROP POLICY IF EXISTS "Allow public inserts on jeunes" ON jeunes;
DROP POLICY IF EXISTS "Admin full access villages" ON villages;
DROP POLICY IF EXISTS "Admin full access jeunes" ON jeunes;
DROP POLICY IF EXISTS "Admin full access vehicules" ON vehicules;
DROP POLICY IF EXISTS "Admin full access equipe_membres" ON equipe_membres;
DROP POLICY IF EXISTS "Admin full access evenements" ON evenements;
DROP POLICY IF EXISTS "Admin full access messages" ON messages;
DROP POLICY IF EXISTS "Admin full access prospection_areas" ON prospection_areas;
DROP POLICY IF EXISTS "Admin full access municipalities" ON municipalities;
DROP POLICY IF EXISTS "Admin full access municipality_enrichments" ON municipality_enrichments;
DROP POLICY IF EXISTS "Admin full access prospection_records" ON prospection_records;
DROP POLICY IF EXISTS "Admin full access prospection_scan_jobs" ON prospection_scan_jobs;
DROP POLICY IF EXISTS "Admin full access prospection_emails" ON prospection_emails;
DROP POLICY IF EXISTS "Admin full access municipality_researches" ON municipality_researches;

-- Public (anon) can submit forms
CREATE POLICY "Allow public inserts on villages" ON villages
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow public inserts on jeunes" ON jeunes
  FOR INSERT TO anon WITH CHECK (true);

-- Authenticated (admin) has full access on all tables
CREATE POLICY "Admin full access villages" ON villages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access jeunes" ON jeunes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access vehicules" ON vehicules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access equipe_membres" ON equipe_membres
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access evenements" ON evenements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access messages" ON messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access prospection_areas" ON prospection_areas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access municipalities" ON municipalities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access municipality_enrichments" ON municipality_enrichments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access prospection_records" ON prospection_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access prospection_scan_jobs" ON prospection_scan_jobs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access prospection_emails" ON prospection_emails
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access municipality_researches" ON municipality_researches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_villages_code_postal ON villages(code_postal);
CREATE INDEX IF NOT EXISTS idx_villages_statut ON villages(statut);
CREATE INDEX IF NOT EXISTS idx_jeunes_email ON jeunes(email);
CREATE INDEX IF NOT EXISTS idx_jeunes_statut ON jeunes(statut);
CREATE INDEX IF NOT EXISTS idx_evenements_dates ON evenements(date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_evenements_vehicule ON evenements(vehicule_id);
CREATE INDEX IF NOT EXISTS idx_equipe_vehicule ON equipe_membres(vehicule_id);
CREATE INDEX IF NOT EXISTS idx_messages_jeune ON messages(jeune_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_municipalities_department ON municipalities(department_code);
CREATE INDEX IF NOT EXISTS idx_municipalities_population ON municipalities(population);
CREATE INDEX IF NOT EXISTS idx_municipalities_location ON municipalities(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_prospection_records_statut ON prospection_records(statut);
CREATE INDEX IF NOT EXISTS idx_prospection_records_area ON prospection_records(area_id);
CREATE INDEX IF NOT EXISTS idx_prospection_records_next_action ON prospection_records(next_action_at);
CREATE INDEX IF NOT EXISTS idx_prospection_scan_jobs_area ON prospection_scan_jobs(area_id);
CREATE INDEX IF NOT EXISTS idx_prospection_scan_jobs_statut ON prospection_scan_jobs(statut);
CREATE INDEX IF NOT EXISTS idx_prospection_emails_municipality ON prospection_emails(municipality_id);
CREATE INDEX IF NOT EXISTS idx_prospection_emails_thread ON prospection_emails(provider_thread_id);
CREATE INDEX IF NOT EXISTS idx_prospection_emails_reply_detected ON prospection_emails(reply_detected_at);
CREATE INDEX IF NOT EXISTS idx_municipality_researches_municipality ON municipality_researches(municipality_id);
