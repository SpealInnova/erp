CREATE TABLE IF NOT EXISTS requisicion_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  requisicion_id INT UNSIGNED NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  cantidad DECIMAL(10, 2) NOT NULL,
  unidad VARCHAR(30) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_requisicion_items_requisicion FOREIGN KEY (requisicion_id) REFERENCES requisiciones(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
