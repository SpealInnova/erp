CREATE TABLE IF NOT EXISTS requisiciones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero_requisicion VARCHAR(20) NOT NULL,
  proyecto_id INT UNSIGNED NOT NULL,
  solicitante_id INT UNSIGNED NOT NULL,
  procedencia ENUM('nacional', 'importacion', 'almacen') NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'solicitada',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_requisiciones_numero (numero_requisicion),
  CONSTRAINT fk_requisiciones_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id),
  CONSTRAINT fk_requisiciones_solicitante FOREIGN KEY (solicitante_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
