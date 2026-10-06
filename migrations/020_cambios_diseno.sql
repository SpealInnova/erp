CREATE TABLE IF NOT EXISTS cambios_diseno (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  expediente_id INT UNSIGNED NOT NULL,
  numero INT UNSIGNED NOT NULL,
  fecha DATE NULL,
  descripcion TEXT NULL,
  motivo TEXT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  aprobado_por INT UNSIGNED NULL,
  aprobado_en DATETIME NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_cambios_diseno_expediente_numero (expediente_id, numero),
  CONSTRAINT fk_cambios_diseno_expediente FOREIGN KEY (expediente_id) REFERENCES expedientes_diseno(id),
  CONSTRAINT fk_cambios_diseno_aprobado_por FOREIGN KEY (aprobado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
