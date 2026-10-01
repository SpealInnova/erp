CREATE TABLE IF NOT EXISTS ordenes_compra (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero_oc VARCHAR(20) NOT NULL,
  requisicion_id INT UNSIGNED NOT NULL,
  proveedor_id INT UNSIGNED NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pte_aprobar',
  aprobado_por INT UNSIGNED NULL,
  aprobado_en DATETIME NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_ordenes_compra_numero (numero_oc),
  CONSTRAINT fk_oc_requisicion FOREIGN KEY (requisicion_id) REFERENCES requisiciones(id),
  CONSTRAINT fk_oc_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
  CONSTRAINT fk_oc_aprobado_por FOREIGN KEY (aprobado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
