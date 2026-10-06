CREATE TABLE IF NOT EXISTS acta_items_verificados (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  acta_id INT UNSIGNED NOT NULL,
  elemento VARCHAR(255) NOT NULL,
  cantidad DECIMAL(10, 2) NOT NULL,
  cumple ENUM('si', 'no') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_acta_items_verificados_acta FOREIGN KEY (acta_id) REFERENCES actas_cierre_satisfaccion(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
