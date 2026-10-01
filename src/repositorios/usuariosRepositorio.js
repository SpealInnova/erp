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
  buscarPorId,
  buscarPorCorreo,
  buscarPorTokenRecuperacion,
  registrarIntentoFallido,
  restablecerIntentosFallidos,
  guardarTokenRecuperacion,
  actualizarPassword,
};
