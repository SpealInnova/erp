-- Registro de equipos instalados: los que salen de un expediente de diseño y
-- los antiguos, anteriores al ERP (sin expediente). Los reportes de servicio
-- se enlazan a este registro por número de serie, para tener trazabilidad
-- de todo equipo, tenga o no expediente.
CREATE TABLE IF NOT EXISTS equipos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero_serie VARCHAR(100) NOT NULL,
  cliente_id INT UNSIGNED NOT NULL,
  proyecto_id INT UNSIGNED NOT NULL,
  expediente_id INT UNSIGNED NULL,
  descripcion VARCHAR(200) NOT NULL,
  marca VARCHAR(100) NULL,
  modelo VARCHAR(100) NULL,
  fecha_instalacion DATE NULL,
  origen ENUM('expediente', 'historico') NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_equipos_numero_serie (numero_serie),
  UNIQUE KEY uq_equipos_expediente (expediente_id),
  CONSTRAINT fk_equipos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  CONSTRAINT fk_equipos_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id),
  CONSTRAINT fk_equipos_expediente FOREIGN KEY (expediente_id) REFERENCES expedientes_diseno(id),
  CONSTRAINT fk_equipos_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
