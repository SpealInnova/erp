CREATE TABLE IF NOT EXISTS proyectos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo_pry VARCHAR(20) NOT NULL,
  cliente_id INT UNSIGNED NOT NULL,
  cotizacion_id INT UNSIGNED NULL,
  linea_negocio VARCHAR(100) NULL,
  nombre_proyecto VARCHAR(200) NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'prospecto',
  responsable_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_proyectos_codigo_pry (codigo_pry),
  CONSTRAINT fk_proyectos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  CONSTRAINT fk_proyectos_responsable FOREIGN KEY (responsable_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
