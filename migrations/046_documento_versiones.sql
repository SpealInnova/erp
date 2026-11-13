-- Versiones reemplazadas de los documentos. Un documento con enlaces no se
-- elimina: se corrige con una nueva versión sobre el mismo registro (así sus
-- documentos enlazados pasan a la versión nueva) y la anterior queda aquí,
-- de solo lectura, con su motivo y una copia completa para la vista previa.
CREATE TABLE IF NOT EXISTS documento_versiones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tabla VARCHAR(50) NOT NULL,
  registro_id INT UNSIGNED NOT NULL,
  version SMALLINT UNSIGNED NOT NULL,
  instantanea JSON NOT NULL,
  motivo VARCHAR(500) NOT NULL,
  reemplazada_por INT UNSIGNED NULL,
  reemplazada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_documento_versiones (tabla, registro_id, version),
  CONSTRAINT fk_documento_versiones_usuario FOREIGN KEY (reemplazada_por) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
