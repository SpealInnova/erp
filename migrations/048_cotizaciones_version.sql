-- Número de la versión vigente del documento (ver documento_versiones).
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS version SMALLINT UNSIGNED NOT NULL DEFAULT 1;
