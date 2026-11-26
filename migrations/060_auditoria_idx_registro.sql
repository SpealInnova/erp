-- Índice por documento para la auditoría y la línea de tiempo del proyecto
-- (buscan los cambios de una tabla y un registro).
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla_registro ON auditoria (tabla, registro_id);
