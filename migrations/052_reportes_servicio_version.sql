-- Número de la versión vigente del documento (ver documento_versiones).
ALTER TABLE reportes_servicio_tecnico ADD COLUMN IF NOT EXISTS version SMALLINT UNSIGNED NOT NULL DEFAULT 1;
