CREATE TABLE IF NOT EXISTS salidas_diseno (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  expediente_id INT UNSIGNED NOT NULL,
  salida VARCHAR(255) NOT NULL,
  codigo_version VARCHAR(50) NULL,
  responsable_id INT UNSIGNED NOT NULL,
  fecha DATE NULL,
  estado VARCHAR(50) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_salidas_diseno_expediente FOREIGN KEY (expediente_id) REFERENCES expedientes_diseno(id),
  CONSTRAINT fk_salidas_diseno_responsable FOREIGN KEY (responsable_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
