-- IF NOT EXISTS: reintento seguro (ver 037).
ALTER TABLE proyecto_actividades ADD COLUMN IF NOT EXISTS fecha_fin DATE NULL AFTER fecha_inicio;
