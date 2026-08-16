-- Image library table for CamperBot
CREATE TABLE IF NOT EXISTS image_library (
    id BIGSERIAL PRIMARY KEY,
    category TEXT NOT NULL,           -- matches bot categories: agua, gas, electricidad, etc.
    subcategory TEXT,                  -- more specific: deposito_agua, entrada_agua, bomba_agua
    description TEXT NOT NULL,         -- human readable description
    image_url TEXT NOT NULL,           -- public URL from Supabase Storage
    company_id TEXT DEFAULT 'generic', -- 'generic', 'benimar', 'hymer', etc.
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_library_category ON image_library(category, company_id);
