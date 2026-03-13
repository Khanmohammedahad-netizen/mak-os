-- Pipeline and CRM SQL Setup (Run in Supabase SQL Editor)

-- 1. Research Cache Table (From Mission 1)
CREATE TABLE IF NOT EXISTS public.research_cache (
  cache_key TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  category TEXT NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS for Cache (Optional/Default)
ALTER TABLE public.research_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read and insert cache" ON public.research_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Opportunities Table (From Mission 2)
CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  city TEXT,
  reply_body TEXT,
  reply_received_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'new_reply',
    -- new_reply | follow_up_sent | call_scheduled |
    -- proposal_sent | negotiating | closed_won | closed_lost
  deal_value_estimate FLOAT,
  notes TEXT,
  next_action TEXT,
  next_action_due DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for Opportunities
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to manage opportunities" ON public.opportunities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Sales Funnel View
DROP VIEW IF EXISTS public.sales_funnel;
CREATE VIEW public.sales_funnel AS
SELECT
  COUNT(*) FILTER (WHERE status = 'new_reply')      AS new_replies,
  COUNT(*) FILTER (WHERE status = 'call_scheduled') AS calls_booked,
  COUNT(*) FILTER (WHERE status = 'proposal_sent')  AS proposals_sent,
  COUNT(*) FILTER (WHERE status = 'closed_won')     AS deals_closed,
  SUM(deal_value_estimate) FILTER (WHERE status = 'closed_won') AS revenue,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'closed_won')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE status != 'new_reply'), 0) * 100
  , 1) AS close_rate_pct
FROM public.opportunities;

-- 4. Automatically Update `updated_at` on Opportunities
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_opportunities_modtime ON public.opportunities;
CREATE TRIGGER update_opportunities_modtime
BEFORE UPDATE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION update_modified_column();
