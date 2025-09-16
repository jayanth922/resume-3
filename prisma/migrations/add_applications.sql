-- Add applications and API keys tables
CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_email TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_preview TEXT NOT NULL, -- First 8 chars for display
  name TEXT NOT NULL,
  environment TEXT NOT NULL,
  permissions TEXT[] DEFAULT '{"read_flags", "log_exposures"}',
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_application ON api_keys(application_id);
CREATE INDEX idx_applications_owner ON applications(owner_email);