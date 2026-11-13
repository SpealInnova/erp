-- Todo reporte de servicio apunta a un equipo del registro (con o sin expediente).
ALTER TABLE reportes_servicio_tecnico
  ADD CONSTRAINT fk_reportes_servicio_equipo_registro FOREIGN KEY (equipo_numero_serie)
    REFERENCES equipos(numero_serie);
