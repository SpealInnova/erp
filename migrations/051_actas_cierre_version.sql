-- Número de la versión vigente del documento (ver documento_versiones).
ALTER TABLE actas_cierre_satisfaccion ADD COLUMN IF NOT EXISTS version SMALLINT UNSIGNED NOT NULL DEFAULT 1;
