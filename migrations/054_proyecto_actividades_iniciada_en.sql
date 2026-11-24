-- Cuándo empezó la actividad (primer paso a "en curso"); base de los tiempos de espera.
ALTER TABLE proyecto_actividades ADD COLUMN IF NOT EXISTS iniciada_en DATETIME NULL AFTER prioridad;
