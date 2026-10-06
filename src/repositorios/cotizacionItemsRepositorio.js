async function insertarMuchos(pool, cotizacionId, items) {
  if (items.length === 0) {
    return;
  }
  const valores = items.map((item) => [
    cotizacionId,
    item.descripcion,
    item.cantidad,
    item.valor_unitario,
    item.descuento_porcentaje ?? 0,
    item.iva_porcentaje ?? 19,
  ]);
  await pool.query(
    `INSERT INTO cotizacion_items
      (cotizacion_id, descripcion, cantidad, valor_unitario, descuento_porcentaje, iva_porcentaje)
     VALUES ?`,
    [valores]
  );
}

async function listarPorCotizacion(pool, cotizacionId) {
  const [filas] = await pool.query(
    "SELECT * FROM cotizacion_items WHERE cotizacion_id = ? ORDER BY id",
    [cotizacionId]
  );
  return filas;
}

async function eliminarPorCotizacion(pool, cotizacionId) {
  await pool.query("DELETE FROM cotizacion_items WHERE cotizacion_id = ?", [cotizacionId]);
}

module.exports = { insertarMuchos, listarPorCotizacion, eliminarPorCotizacion };
