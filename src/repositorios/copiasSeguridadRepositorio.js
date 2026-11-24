// Registro de las copias de seguridad (tabla copias_seguridad).

async function crear(pool, { origen, solicitadaPor }) {
  const [r] = await pool.query(
    "INSERT INTO copias_seguridad (origen, solicitada_por) VALUES (?, ?)",
    [origen, solicitadaPor || null]
  );
  return r.insertId;
}

async function terminar(pool, id, datos) {
  const campos = Object.keys(datos);
  await pool.query(
    `UPDATE copias_seguridad SET ${campos.map((c) => `${c} = ?`).join(", ")},
            terminada_en = NOW()
      WHERE id = ?`,
    [...campos.map((c) => datos[c]), id]
  );
}

async function obtenerPorId(pool, id) {
  const [filas] = await pool.query(
    `SELECT c.*, u.nombre AS solicitada_por_nombre
       FROM copias_seguridad c
       LEFT JOIN usuarios u ON u.id = c.solicitada_por
      WHERE c.id = ?`,
    [id]
  );
  return filas[0] || null;
}

async function listarRecientes(pool, limite = 30) {
  const [filas] = await pool.query(
    `SELECT c.*, u.nombre AS solicitada_por_nombre
       FROM copias_seguridad c
       LEFT JOIN usuarios u ON u.id = c.solicitada_por
      ORDER BY c.iniciada_en DESC, c.id DESC
      LIMIT ?`,
    [limite]
  );
  return filas;
}

// Copias automáticas de los últimos `minutos` (desde la hora de copia de hoy),
// para no repetir la copia del día ni insistir sin fin si Drive falla. Se
// compara con NOW() de la base, la misma zona horaria con la que se guardó
// iniciada_en, así no depende de la zona del servidor de la aplicación.
async function automaticasDesde(pool, minutos) {
  const [[fila]] = await pool.query(
    `SELECT COALESCE(SUM(resultado = 'exitosa'), 0) AS exitosas,
            COALESCE(SUM(resultado = 'fallida'), 0) AS fallidas
       FROM copias_seguridad
      WHERE origen = 'automatica' AND iniciada_en >= NOW() - INTERVAL ? MINUTE`,
    [minutos]
  );
  return { exitosas: Number(fila.exitosas), fallidas: Number(fila.fallidas) };
}

// Una copia que quedó "en_curso" (p. ej. el proceso se reinició a mitad)
// pasa a fallida para que el registro no la muestre corriendo para siempre.
async function cerrarInterrumpidas(pool, minutos = 60) {
  await pool.query(
    `UPDATE copias_seguridad
        SET resultado = 'fallida', terminada_en = NOW(),
            error = 'Se interrumpió antes de terminar (reinicio del servidor).'
      WHERE resultado = 'en_curso' AND iniciada_en < NOW() - INTERVAL ? MINUTE`,
    [minutos]
  );
}

module.exports = {
  crear,
  terminar,
  obtenerPorId,
  listarRecientes,
  automaticasDesde,
  cerrarInterrumpidas,
};
