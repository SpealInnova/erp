-- Todo reporte de servicio apunta a un equipo del registro (con o sin expediente).
-- IF NOT EXISTS: reintento seguro si la llave ya se creó (ver 042).
ALTER TABLE reportes_servicio_tecnico
  ADD CONSTRAINT fk_reportes_servicio_equipo_registro FOREIGN KEY IF NOT EXISTS (equipo_numero_serie)
    REFERENCES equipos(numero_serie);
