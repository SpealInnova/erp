CREATE TABLE IF NOT EXISTS revisiones_diseno (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  expediente_id INT UNSIGNED NOT NULL,
  numero INT UNSIGNED NOT NULL,
  fecha DATE NULL,
  hallazgos TEXT NULL,
  acciones TEXT NULL,
  responsable_id INT UNSIGNED NOT NULL,
  cierre ENUM('si', 'no') NOT NULL DEFAULT 'no',
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_revisiones_diseno_expediente_numero (expediente_id, numero),
  CONSTRAINT fk_revisiones_diseno_expediente FOREIGN KEY (expediente_id) REFERENCES expedientes_diseno(id),
  CONSTRAINT fk_revisiones_diseno_responsable FOREIGN KEY (responsable_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
