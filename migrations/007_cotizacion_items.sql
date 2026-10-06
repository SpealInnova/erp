CREATE TABLE IF NOT EXISTS cotizacion_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cotizacion_id INT UNSIGNED NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  cantidad DECIMAL(10, 2) NOT NULL,
  valor_unitario DECIMAL(12, 2) NOT NULL,
  descuento_porcentaje DECIMAL(5, 2) NOT NULL DEFAULT 0,
  iva_porcentaje DECIMAL(5, 2) NOT NULL DEFAULT 19,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cotizacion_items_cotizacion FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
