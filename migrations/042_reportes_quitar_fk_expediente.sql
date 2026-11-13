-- El equipo de un reporte de servicio deja de exigir un expediente de diseño:
-- pasa a enlazarse con el registro de equipos (siguiente migración).
-- IF EXISTS: si la llave ya se quitó pero la migración no quedó registrada,
-- el reintento al arrancar no falla.
ALTER TABLE reportes_servicio_tecnico DROP FOREIGN KEY IF EXISTS fk_reportes_servicio_equipo;
