CREATE TABLE IF NOT EXISTS archivos_adjuntos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tabla VARCHAR(50) NOT NULL,
  registro_id INT UNSIGNED NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  tamano_bytes INT UNSIGNED NOT NULL,
  drive_file_id VARCHAR(100) NOT NULL,
  drive_enlace VARCHAR(500) NULL,
  subido_por INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_archivos_adjuntos_subido_por FOREIGN KEY (subido_por) REFERENCES usuarios(id),
  INDEX idx_archivos_adjuntos_tabla_registro (tabla, registro_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
