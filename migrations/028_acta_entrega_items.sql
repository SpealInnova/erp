CREATE TABLE IF NOT EXISTS acta_entrega_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  acta_id INT UNSIGNED NOT NULL,
  descripcion_equipo VARCHAR(255) NOT NULL,
  cantidad DECIMAL(10, 2) NOT NULL,
  marca VARCHAR(100) NULL,
  modelo VARCHAR(100) NULL,
  numero_serie VARCHAR(100) NULL,
  expediente_id INT UNSIGNED NULL,
  cumple ENUM('si', 'no') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_acta_entrega_items_acta FOREIGN KEY (acta_id) REFERENCES actas_entrega_equipos(id),
  CONSTRAINT fk_acta_entrega_items_expediente FOREIGN KEY (expediente_id) REFERENCES expedientes_diseno(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
