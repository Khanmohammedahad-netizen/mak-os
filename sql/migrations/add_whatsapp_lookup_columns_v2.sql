-- Migration: Add WhatsApp lookup caching columns to 'leads' table
-- This enables persistent registration status to prevent redundant Twilio Lookup costs ($0.005/lookup).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS whatsapp_registered BOOLEAN,
  ADD COLUMN IF NOT EXISTS whatsapp_checked_at TIMESTAMPTZ;

-- Index for registration status to quickly filter reachable leads
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_registered ON public.leads(whatsapp_registered);
