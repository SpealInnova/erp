CREATE TABLE IF NOT EXISTS auditoria (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tabla VARCHAR(100) NOT NULL,
  registro_id INT UNSIGNED NOT NULL,
  accion ENUM('crear', 'actualizar', 'eliminar') NOT NULL,
  usuario_id INT UNSIGNED NULL,
  datos_anteriores JSON NULL,
  datos_nuevos JSON NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
