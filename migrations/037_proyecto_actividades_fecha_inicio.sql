-- IF NOT EXISTS: si la columna se creó pero la migración no quedó registrada,
-- el reintento al arrancar no falla (y la app no queda caída).
ALTER TABLE proyecto_actividades ADD COLUMN IF NOT EXISTS fecha_inicio DATE NULL AFTER orden;
