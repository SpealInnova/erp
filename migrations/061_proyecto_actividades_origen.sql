-- De dónde viene la actividad: 'plantilla' (catálogo de la fase) o 'manual'
-- (subactividad agregada por una persona). Así agregar una subactividad a
-- una fase futura no impide que esa fase reciba después sus actividades de
-- plantilla.
ALTER TABLE proyecto_actividades ADD COLUMN IF NOT EXISTS origen VARCHAR(10) NOT NULL DEFAULT 'plantilla' AFTER orden;
