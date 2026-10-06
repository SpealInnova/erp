CREATE TABLE IF NOT EXISTS cotizaciones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero_cotizacion VARCHAR(20) NOT NULL,
  cliente_id INT UNSIGNED NOT NULL,
  asesor_comercial_id INT UNSIGNED NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
  fecha_validez DATE NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_cotizaciones_numero (numero_cotizacion),
  CONSTRAINT fk_cotizaciones_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  CONSTRAINT fk_cotizaciones_asesor FOREIGN KEY (asesor_comercial_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
