CREATE TABLE IF NOT EXISTS expedientes_diseno (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo_expediente VARCHAR(20) NOT NULL,
  proyecto_id INT UNSIGNED NOT NULL,
  producto_nombre VARCHAR(200) NOT NULL,
  modelo VARCHAR(100) NULL,
  numero_serie VARCHAR(100) NULL,
  responsable_diseno_id INT UNSIGNED NOT NULL,
  estado_liberacion VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_expedientes_codigo (codigo_expediente),
  UNIQUE KEY uq_expedientes_numero_serie (numero_serie),
  CONSTRAINT fk_expedientes_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id),
  CONSTRAINT fk_expedientes_responsable FOREIGN KEY (responsable_diseno_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
