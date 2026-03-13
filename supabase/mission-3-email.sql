-- Mission 3: Email Deliverability & Suppression

CREATE TABLE IF NOT EXISTS public.email_suppression_list (
  email TEXT PRIMARY KEY,
  reason TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.email_suppression_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated to manage suppression list" ON public.email_suppression_list 
FOR ALL TO authenticated USING (true) WITH CHECK (true);
