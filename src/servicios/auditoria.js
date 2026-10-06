async function registrar(pool, { tabla, registroId, accion, usuarioId, datosAnteriores, datosNuevos }) {
  await pool.query(
    `INSERT INTO auditoria (tabla, registro_id, accion, usuario_id, datos_anteriores, datos_nuevos)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      tabla,
      registroId,
      accion,
      usuarioId || null,
      datosAnteriores ? JSON.stringify(datosAnteriores) : null,
      datosNuevos ? JSON.stringify(datosNuevos) : null,
    ]
  );
}

module.exports = { registrar };
