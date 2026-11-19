-- Registro de las copias de seguridad del ERP (estado completo de la base,
-- comprimido, en Drive): fecha, resultado, tamaño y archivo. Lo llena
-- servicios/copiasSeguridad.js; el panel de copias lo muestra.
CREATE TABLE IF NOT EXISTS copias_seguridad (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  iniciada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  terminada_en DATETIME NULL,
  resultado VARCHAR(20) NOT NULL DEFAULT 'en_curso',
  origen VARCHAR(20) NOT NULL DEFAULT 'automatica',
  tablas INT UNSIGNED NULL,
  registros INT UNSIGNED NULL,
  tamano_bytes BIGINT UNSIGNED NULL,
  archivo_nombre VARCHAR(255) NULL,
  drive_archivo_id VARCHAR(100) NULL,
  drive_enlace VARCHAR(500) NULL,
  error VARCHAR(1000) NULL,
  solicitada_por INT UNSIGNED NULL,
  INDEX idx_copias_seguridad_fecha (iniciada_en),
  CONSTRAINT fk_copias_seguridad_usuario FOREIGN KEY (solicitada_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
