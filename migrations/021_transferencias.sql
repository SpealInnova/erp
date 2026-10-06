CREATE TABLE IF NOT EXISTS transferencias (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  expediente_id INT UNSIGNED NOT NULL,
  elemento_transferido VARCHAR(255) NOT NULL,
  area_receptora VARCHAR(255) NULL,
  responsable_id INT UNSIGNED NOT NULL,
  fecha DATE NULL,
  cumple ENUM('si', 'no') NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_transferencias_expediente FOREIGN KEY (expediente_id) REFERENCES expedientes_diseno(id),
  CONSTRAINT fk_transferencias_responsable FOREIGN KEY (responsable_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
