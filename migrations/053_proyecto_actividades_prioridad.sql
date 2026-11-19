-- Prioridad de la actividad: normal (no se muestra), alta (amarillo) o urgente (rojo).
ALTER TABLE proyecto_actividades ADD COLUMN IF NOT EXISTS prioridad VARCHAR(10) NOT NULL DEFAULT 'normal' AFTER estado;
