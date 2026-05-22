ALTER TABLE prospection_emails
  ADD COLUMN IF NOT EXISTS provider_thread_id TEXT,
  ADD COLUMN IF NOT EXISTS reply_message_id TEXT,
  ADD COLUMN IF NOT EXISTS reply_detected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reply_from TEXT,
  ADD COLUMN IF NOT EXISTS reply_subject TEXT,
  ADD COLUMN IF NOT EXISTS reply_snippet TEXT;

CREATE INDEX IF NOT EXISTS idx_prospection_emails_thread ON prospection_emails(provider_thread_id);
CREATE INDEX IF NOT EXISTS idx_prospection_emails_reply_detected ON prospection_emails(reply_detected_at);
