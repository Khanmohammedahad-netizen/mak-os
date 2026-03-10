-- Add scheduler_config table to track Vercel Cron state
CREATE TABLE IF NOT EXISTS scheduler_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduler_enabled BOOLEAN DEFAULT TRUE,
  daily_send_limit INTEGER DEFAULT 30,
  daily_budget_cap FLOAT DEFAULT 10.00,
  cities TEXT[] DEFAULT ARRAY['Chicago', 'Dallas', 'Houston', 'Miami', 'New York'],
  notification_email TEXT,
  touch2_delay_days INTEGER DEFAULT 4,
  touch3_delay_days INTEGER DEFAULT 10,
  require_review BOOLEAN DEFAULT FALSE,
  timezone TEXT DEFAULT 'America/Chicago',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default config row
INSERT INTO scheduler_config (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- City rotation view (current day's cities)
CREATE OR REPLACE VIEW todays_cities AS
SELECT 
  CASE EXTRACT(DOW FROM NOW())
    WHEN 1 THEN ARRAY['Chicago', 'Dallas']
    WHEN 2 THEN ARRAY['Houston', 'Miami']
    WHEN 3 THEN ARRAY['New York', 'Chicago']
    WHEN 4 THEN ARRAY['Dallas', 'Houston']
    WHEN 5 THEN ARRAY['Miami', 'New York']
    WHEN 6 THEN ARRAY['Chicago', 'New York']
    ELSE ARRAY[]::TEXT[]
  END AS cities_today;
