-- Álbum da viagem: metadados das mídias (os arquivos ficam no R2).
CREATE TABLE media (
  id               TEXT PRIMARY KEY,                -- uuid
  r2_key           TEXT NOT NULL,                   -- originals/{hash}.{ext}
  thumb_key        TEXT NOT NULL,                   -- thumbs/{hash}.jpg   (~480px)
  preview_key      TEXT,                            -- previews/{hash}.jpg (~1600px, só fotos)
  hash             TEXT NOT NULL UNIQUE,            -- SHA-256 do original (deduplicação)
  tipo             TEXT NOT NULL CHECK (tipo IN ('foto', 'video')),
  mime             TEXT NOT NULL,
  ext              TEXT NOT NULL,
  nome_original    TEXT,
  tamanho_bytes    INTEGER NOT NULL,
  largura          INTEGER,
  altura           INTEGER,
  duracao_s        REAL,
  captured_at_utc  TEXT NOT NULL,                   -- ISO 8601 em UTC (sempre toISOString)
  data_aproximada  INTEGER NOT NULL DEFAULT 0,      -- 1 = sem metadado, veio de lastModified
  fonte_data       TEXT NOT NULL,                   -- exif | quicktime | mvhd | lastModified | manual
  enviado_por      TEXT NOT NULL,
  enviado_em       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'completo')),
  upload_id        TEXT                             -- multipart em andamento (para limpeza)
);

CREATE INDEX idx_media_captured ON media (status, captured_at_utc, id);
CREATE INDEX idx_media_autor ON media (enviado_por);

-- Rate limit do login (tentativas erradas por IP numa janela de 15 min).
CREATE TABLE login_attempts (
  ip            TEXT PRIMARY KEY,
  tentativas    INTEGER NOT NULL,
  janela_inicio INTEGER NOT NULL                    -- epoch ms
);
