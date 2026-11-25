-- Índice por fecha para la pantalla de auditoría (se lista de lo más
-- reciente a lo más antiguo y se filtra por rango de fechas).
CREATE INDEX IF NOT EXISTS idx_auditoria_creado_en ON auditoria (creado_en);
