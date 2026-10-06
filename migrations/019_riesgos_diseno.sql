CREATE TABLE IF NOT EXISTS riesgos_diseno (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  expediente_id INT UNSIGNED NOT NULL,
  peligro VARCHAR(255) NOT NULL,
  situacion_peligrosa VARCHAR(255) NULL,
  dano_potencial VARCHAR(255) NULL,
  severidad VARCHAR(50) NULL,
  probabilidad VARCHAR(50) NULL,
  control VARCHAR(255) NULL,
  responsable_id INT UNSIGNED NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_riesgos_diseno_expediente FOREIGN KEY (expediente_id) REFERENCES expedientes_diseno(id),
  CONSTRAINT fk_riesgos_diseno_responsable FOREIGN KEY (responsable_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
