async function listarActivos(pool) {
  const [filas] = await pool.query(
    `SELECT id, nombre, correo, cedula, rol, cargo, activo
     FROM usuarios WHERE deleted_at IS NULL AND activo = 1 ORDER BY nombre`
  );
  return filas;
}

async function buscarPorId(pool, id) {
  const [filas] = await pool.query(
    "SELECT * FROM usuarios WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [id]
  );
  return filas[0] || null;
}

async function buscarPorCorreo(pool, correo) {
  const [filas] = await pool.query(
    "SELECT * FROM usuarios WHERE correo = ? AND deleted_at IS NULL LIMIT 1",
    [correo]
  );
  return filas[0] || null;
}

async function buscarPorCedula(pool, cedula) {
  const [filas] = await pool.query(
    "SELECT * FROM usuarios WHERE cedula = ? AND deleted_at IS NULL LIMIT 1",
    [cedula]
  );
  return filas[0] || null;
}

async function crear(pool, datos) {
  const [resultado] = await pool.query(
    `INSERT INTO usuarios (nombre, correo, cedula, password_hash, rol, cargo, activo)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [datos.nombre, datos.correo, datos.cedula, datos.password_hash, datos.rol, datos.cargo]
  );
  return resultado.insertId;
}

async function buscarPorTokenRecuperacion(pool, token) {
  const [filas] = await pool.query(
    "SELECT * FROM usuarios WHERE token_recuperacion = ? AND deleted_at IS NULL LIMIT 1",
    [token]
  );
  return filas[0] || null;
}

async function registrarIntentoFallido(pool, id, intentosFallidos, bloqueadoHasta) {
  await pool.query(
    "UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?",
    [intentosFallidos, bloqueadoHasta, id]
  );
}

async function restablecerIntentosFallidos(pool, id) {
  await pool.query(
    "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?",
    [id]
  );
}

async function guardarTokenRecuperacion(pool, id, token, expira) {
  await pool.query(
    "UPDATE usuarios SET token_recuperacion = ?, token_recuperacion_expira = ? WHERE id = ?",
    [token, expira, id]
  );
}

async function actualizarPassword(pool, id, passwordHash) {
  await pool.query(
    `UPDATE usuarios
     SET password_hash = ?, token_recuperacion = NULL, token_recuperacion_expira = NULL,
         intentos_fallidos = 0, bloqueado_hasta = NULL
     WHERE id = ?`,
    [passwordHash, id]
  );
}

module.exports = {
  listarActivos,
  buscarPorId,
  buscarPorCorreo,
  buscarPorCedula,
  crear,
  buscarPorTokenRecuperacion,
  registrarIntentoFallido,
  restablecerIntentosFallidos,
  guardarTokenRecuperacion,
  actualizarPassword,
};
