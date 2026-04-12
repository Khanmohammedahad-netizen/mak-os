-- Add per-channel outreach tracking columns to leads table
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_status TEXT DEFAULT NULL;

-- Optional: Comments for clarity
COMMENT ON COLUMN leads.email_status IS 'Values: sent, failed, bounced';
COMMENT ON COLUMN leads.whatsapp_status IS 'Values: sent, delivered, failed, unregistered';
