ALTER TABLE usuarios
  ADD COLUMN cedula VARCHAR(20) NULL AFTER correo,
  ADD COLUMN cargo VARCHAR(150) NULL AFTER rol,
  ADD UNIQUE KEY uq_usuarios_cedula (cedula);
