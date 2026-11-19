-- Tareas fuera de proyectos (gestor de tareas). Cualquier usuario las crea y
-- puede asignarlas a otra persona. Relación opcional con cliente, proyecto o
-- documento (código, p. ej. COT-2026-041).
CREATE TABLE IF NOT EXISTS tareas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT NULL,
  responsable_id INT UNSIGNED NOT NULL,
  prioridad VARCHAR(10) NOT NULL DEFAULT 'normal',
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  fecha_inicio DATE NULL,
  fecha_fin DATE NULL,
  cliente_id INT UNSIGNED NULL,
  proyecto_id INT UNSIGNED NULL,
  documento VARCHAR(80) NULL,
  iniciada_en DATETIME NULL,
  completada_en DATETIME NULL,
  completada_por INT UNSIGNED NULL,
  created_by INT UNSIGNED NOT NULL,
  updated_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_tareas_responsable (responsable_id, estado),
  KEY idx_tareas_creador (created_by),
  CONSTRAINT fk_tareas_responsable FOREIGN KEY (responsable_id) REFERENCES usuarios(id),
  CONSTRAINT fk_tareas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  CONSTRAINT fk_tareas_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id),
  CONSTRAINT fk_tareas_creador FOREIGN KEY (created_by) REFERENCES usuarios(id),
  CONSTRAINT fk_tareas_completada_por FOREIGN KEY (completada_por) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
