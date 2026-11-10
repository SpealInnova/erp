CREATE TABLE IF NOT EXISTS proyecto_drive_carpetas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proyecto_id INT UNSIGNED NOT NULL,
  fase VARCHAR(30) NOT NULL,
  drive_folder_id VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_proyecto_drive_carpetas (proyecto_id, fase),
  CONSTRAINT fk_proyecto_drive_carpetas_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
