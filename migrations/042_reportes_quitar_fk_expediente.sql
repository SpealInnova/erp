-- El equipo de un reporte de servicio deja de exigir un expediente de diseño:
-- pasa a enlazarse con el registro de equipos (siguiente migración).
ALTER TABLE reportes_servicio_tecnico DROP FOREIGN KEY fk_reportes_servicio_equipo;
