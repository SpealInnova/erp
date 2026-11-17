-- Todo reporte de servicio debe estar asociado a un proyecto.
ALTER TABLE reportes_servicio_tecnico MODIFY proyecto_id INT UNSIGNED NOT NULL;
