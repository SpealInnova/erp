-- Responsables de cada etapa (fase) de un proyecto: pueden ser varios por
-- etapa. Reciben los avisos de vencimiento de las actividades sin responsable
-- de su etapa, ven el proyecto en su inicio y aparecen en la ficha. Aprobada
-- por el responsable el 2026-11-27.
CREATE TABLE IF NOT EXISTS proyecto_fase_responsables (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proyecto_id INT UNSIGNED NOT NULL,
  fase VARCHAR(30) NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_proyecto_fase_responsable (proyecto_id, fase, usuario_id),
  KEY idx_fase_responsables_usuario (usuario_id),
  CONSTRAINT fk_fase_responsables_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id),
  CONSTRAINT fk_fase_responsables_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_fase_responsables_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
