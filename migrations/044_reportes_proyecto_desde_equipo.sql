-- Los reportes registrados sin proyecto quedan en el proyecto de su equipo,
-- antes de volver obligatorio el proyecto (siguiente migración).
UPDATE reportes_servicio_tecnico r
JOIN equipos q ON q.numero_serie = r.equipo_numero_serie
SET r.proyecto_id = q.proyecto_id
WHERE r.proyecto_id IS NULL;
