-- Chez Armand Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Create villages table
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create jeunes table
CREATE TABLE IF NOT EXISTS jeunes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  age INTEGER NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT NOT NULL,
  motivation TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE jeunes ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public inserts (anon = Supabase anonymous client role)
CREATE POLICY "Allow public inserts on villages" ON villages
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public inserts on jeunes" ON jeunes
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_villages_code_postal ON villages(code_postal);
CREATE INDEX IF NOT EXISTS idx_jeunes_email ON jeunes(email);

