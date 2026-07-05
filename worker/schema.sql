-- Don QR Code — schema D1 (SQLite na edge)

-- Meta: armazena salt + verifier da passphrase mestra, versão do schema, etc.
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- QR codes. O campo `payload` é sempre cifrado (AES-GCM) no cliente antes de
-- chegar aqui; o Worker nunca vê o conteúdo real.
CREATE TABLE IF NOT EXISTS qrcodes (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,            -- 'static' | 'dynamic'
  kind          TEXT NOT NULL,            -- 'url' | 'text' | 'vcard' | ...
  title         TEXT NOT NULL,
  tags          TEXT NOT NULL DEFAULT '[]',  -- JSON array (cifrado junto se sensível? não — tags ficam plaintext p/ filtrar)
  payload       TEXT NOT NULL,            -- 'iv:ciphertext' em base64
  styling       TEXT NOT NULL DEFAULT '{}',  -- JSON object (não sensível)
  password_hash TEXT,                     -- PBKDF2 hash se QR é protegido por senha (Fase 7)
  expires_at    TEXT,                     -- ISO date (QRs dinâmicos)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT                      -- soft delete
);

CREATE INDEX IF NOT EXISTS idx_qrcodes_created ON qrcodes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qrcodes_deleted ON qrcodes(deleted_at);
