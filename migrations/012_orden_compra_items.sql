CREATE TABLE IF NOT EXISTS orden_compra_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  orden_compra_id INT UNSIGNED NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  cantidad DECIMAL(10, 2) NOT NULL,
  precio_unitario DECIMAL(12, 2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_oc_items_orden FOREIGN KEY (orden_compra_id) REFERENCES ordenes_compra(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
