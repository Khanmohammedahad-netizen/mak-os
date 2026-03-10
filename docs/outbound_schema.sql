-- ==============================================================================
-- MAK Outbound Lead Generation Engine
-- Schema: outbound
-- Note: This is strictly isolated from the public MAK OS SaaS schema.
-- ==============================================================================

-- Create isolated schema
CREATE SCHEMA IF NOT EXISTS outbound;

-- Define Enums for type safety (better than CHECK constraints for indexing and validation)
CREATE TYPE outbound.lead_status AS ENUM ('pending', 'enriched', 'failed');
CREATE TYPE outbound.crm_stage AS ENUM ('cold', 'in_sequence', 'replied', 'bounced', 'unsubscribed', 'qualified');
CREATE TYPE outbound.campaign_status AS ENUM ('active', 'paused', 'completed');
CREATE TYPE outbound.queue_status AS ENUM ('pending', 'processing', 'sent', 'failed', 'cancelled');

-- 1. Leads Table
CREATE TABLE outbound.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    domain TEXT UNIQUE NOT NULL, -- Strict uniqueness
    contact_name TEXT,
    contact_email TEXT UNIQUE,   -- Strict uniqueness
    country TEXT,
    industry TEXT,
    enrichment_status outbound.lead_status DEFAULT 'pending',
    crm_stage outbound.crm_stage DEFAULT 'cold',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Campaigns Table
CREATE TABLE outbound.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status outbound.campaign_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Email Queue Table (The Dispatcher Engine)
CREATE TABLE outbound.email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES outbound.leads(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES outbound.campaigns(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    status outbound.queue_status DEFAULT 'pending',
    message_id TEXT, -- To track the Zoho Message-ID
    error_log TEXT,
    sent_at TIMESTAMPTZ,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- IDEMPOTENCY: Physically impossible to queue the same step twice for a lead
    CONSTRAINT uq_lead_step UNIQUE (lead_id, step_number)
);

-- Indexes for performance
-- 1. Dispatcher requires ultra-fast lookup on pending items scheduled for now or past
CREATE INDEX idx_dispatcher_lookup ON outbound.email_queue (scheduled_for, status) WHERE status = 'pending';

-- 2. Webhook lookup speed (when a reply comes in, we need the lead)
CREATE INDEX idx_leads_contact_email ON outbound.leads (contact_email);

-- 3. Cancel queue lookup speed
CREATE INDEX idx_queue_cancellation ON outbound.email_queue (lead_id, status) WHERE status = 'pending';

-- Enable Row Level Security (RLS)
-- By enabling it without adding any policies, we default-deny all access via the public API (anon/authenticated).
-- n8n uses the Supabase Service Role key, which bypasses RLS completely.
ALTER TABLE outbound.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound.email_queue ENABLE ROW LEVEL SECURITY;
