async function crear(pool, { usuarioId, tipo, mensaje, enlace }) {
  const [resultado] = await pool.query(
    "INSERT INTO notificaciones (usuario_id, tipo, mensaje, enlace) VALUES (?, ?, ?, ?)",
    [usuarioId, tipo, mensaje, enlace || null]
  );
  return resultado.insertId;
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query("SELECT * FROM notificaciones WHERE id = ? LIMIT 1", [id]);
  return filas[0] || null;
}

async function listarPorUsuario(pool, usuarioId, limite) {
  const [filas] = await pool.query(
    "SELECT * FROM notificaciones WHERE usuario_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
    [usuarioId, limite]
  );
  return filas;
}

async function contarNoLeidas(pool, usuarioId) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM notificaciones WHERE usuario_id = ? AND leida_en IS NULL",
    [usuarioId]
  );
  return filas[0].total;
}

async function marcarLeida(pool, id) {
  await pool.query("UPDATE notificaciones SET leida_en = NOW() WHERE id = ?", [id]);
}

async function marcarTodasLeidas(pool, usuarioId) {
  await pool.query(
    "UPDATE notificaciones SET leida_en = NOW() WHERE usuario_id = ? AND leida_en IS NULL",
    [usuarioId]
  );
}

async function existeReciente(pool, { usuarioId, tipo, enlace, dias }) {
  const [filas] = await pool.query(
    `SELECT 1 FROM notificaciones
      WHERE usuario_id = ? AND tipo = ? AND enlace = ? AND created_at >= NOW() - INTERVAL ? DAY
      LIMIT 1`,
    [usuarioId, tipo, enlace, dias]
  );
  return filas.length > 0;
}

module.exports = {
  existeReciente,
  crear,
  obtenerPorId,
  listarPorUsuario,
  contarNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
};
