CREATE TABLE IF NOT EXISTS clientes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre_razon_social VARCHAR(200) NOT NULL,
  tipo_identificacion ENUM('CC', 'NIT', 'CE', 'Pasaporte') NOT NULL,
  numero_identificacion VARCHAR(50) NOT NULL,
  pais VARCHAR(100) NULL,
  ciudad VARCHAR(100) NULL,
  direccion VARCHAR(255) NULL,
  contacto_nombre VARCHAR(150) NULL,
  contacto_telefono VARCHAR(50) NULL,
  contacto_email VARCHAR(150) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_clientes_numero_identificacion (numero_identificacion),
  CONSTRAINT fk_clientes_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
