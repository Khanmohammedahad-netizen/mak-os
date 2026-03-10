-- MAK OS v1 Master System Pipeline Schema

-- 1. Updates to existing 'leads' table
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS email_confidence TEXT,
  ADD COLUMN IF NOT EXISTS website_category TEXT,
  ADD COLUMN IF NOT EXISTS lead_score FLOAT,
  ADD COLUMN IF NOT EXISTS priority TEXT,
  ADD COLUMN IF NOT EXISTS opportunity_summary TEXT,
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS social_links TEXT[],
  ADD COLUMN IF NOT EXISTS sources TEXT[];

-- 2. New Table: outreach_log
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
CREATE INDEX IF NOT EXISTS idx_outreach_log_lead_id ON public.outreach_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_log_email ON public.outreach_log(email_address);

-- 3. New Table: replies
CREATE TABLE IF NOT EXISTS public.replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    outreach_id UUID REFERENCES public.outreach_log(id) ON DELETE SET NULL,
    reply_body TEXT,
    reply_from TEXT,
    received_at TIMESTAMP WITH TIME ZONE,
    sentiment TEXT,
    suggested_response TEXT,
    operator_notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. New Table: research_cache
CREATE TABLE IF NOT EXISTS public.research_cache (
    cache_key TEXT PRIMARY KEY,
    raw_data JSONB,
    city TEXT,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 5. New Table: email_cache
CREATE TABLE IF NOT EXISTS public.email_cache (
    domain TEXT PRIMARY KEY,
    email TEXT,
    confidence TEXT,
    source TEXT,
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. New Table: pipeline_runs
CREATE TABLE IF NOT EXISTS public.pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triggered_by TEXT,
    city TEXT,
    category TEXT,
    leads_found INTEGER DEFAULT 0,
    leads_passed INTEGER DEFAULT 0,
    leads_rejected INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    emails_failed INTEGER DEFAULT 0,
    run_started_at TIMESTAMP WITH TIME ZONE,
    run_completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT,
    error_log TEXT[],
    cost_estimate FLOAT DEFAULT 0.0
);

-- 7. New Table: api_cost_log
CREATE TABLE IF NOT EXISTS public.api_cost_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service TEXT,
    action TEXT,
    estimated_cost_usd FLOAT,
    pipeline_run_id UUID REFERENCES public.pipeline_runs(id) ON DELETE CASCADE,
    called_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Enable Row Level Security (RLS) on new tables
ALTER TABLE public.outreach_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_cost_log ENABLE ROW LEVEL SECURITY;

-- 9. Setup default RLS policies (adjust to your auth logic)
CREATE POLICY "Enable all access for authenticated users" ON public.outreach_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.replies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.research_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.email_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.pipeline_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.api_cost_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
