-- Cada cambio de estado de actividades, tareas y fases de proyecto, con su hora.
-- Es la base de los tiempos de los procesos (espera, en curso, días por fase).
-- proyecto_id se guarda también para consultar todo lo de un proyecto de una vez.
CREATE TABLE IF NOT EXISTS transiciones_estado (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entidad VARCHAR(20) NOT NULL,
  registro_id INT UNSIGNED NOT NULL,
  proyecto_id INT UNSIGNED NULL,
  estado_anterior VARCHAR(30) NULL,
  estado_nuevo VARCHAR(30) NOT NULL,
  usuario_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_transiciones_registro (entidad, registro_id, created_at),
  KEY idx_transiciones_proyecto (proyecto_id, created_at),
  CONSTRAINT fk_transiciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
