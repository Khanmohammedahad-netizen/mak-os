-- Migration: Setup outreach_log and Add WhatsApp columns
-- Stage 1: Ensure base table exists (from Master Pipeline setup)
CREATE TABLE IF NOT EXISTS public.outreach_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    business_name TEXT,
    email_address TEXT,
    touch_number INTEGER,
    subject TEXT,
    body TEXT,
    send_status TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    sequence_status TEXT,
    variant_used TEXT,
    gate_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stage 2: Add WhatsApp-specific columns (WhatsApp Outreach Fallback)
ALTER TABLE public.outreach_log ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'email';
ALTER TABLE public.outreach_log ADD COLUMN IF NOT EXISTS message_sid TEXT;
ALTER TABLE public.outreach_log ADD COLUMN IF NOT EXISTS wa_status TEXT;

-- Indices for performance and tracking
CREATE INDEX IF NOT EXISTS idx_outreach_log_lead_id ON public.outreach_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_log_email ON public.outreach_log(email_address);
CREATE INDEX IF NOT EXISTS idx_outreach_log_message_sid ON public.outreach_log(message_sid);
