CREATE TABLE IF NOT EXISTS requisitos_entrada (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  expediente_id INT UNSIGNED NOT NULL,
  requisito VARCHAR(255) NOT NULL,
  valor VARCHAR(255) NULL,
  fuente VARCHAR(255) NULL,
  criterio_aceptacion VARCHAR(255) NULL,
  evidencia VARCHAR(255) NULL,
  cumple ENUM('si', 'no') NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_requisitos_entrada_expediente FOREIGN KEY (expediente_id) REFERENCES expedientes_diseno(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
