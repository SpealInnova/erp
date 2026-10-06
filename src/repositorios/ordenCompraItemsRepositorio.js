async function insertarMuchos(pool, ordenCompraId, items) {
  if (items.length === 0) {
    return;
  }
  const valores = items.map((item) => [
    ordenCompraId,
    item.descripcion,
    item.cantidad,
    item.precio_unitario,
  ]);
  await pool.query(
    "INSERT INTO orden_compra_items (orden_compra_id, descripcion, cantidad, precio_unitario) VALUES ?",
    [valores]
  );
}

async function listarPorOrden(pool, ordenCompraId) {
  const [filas] = await pool.query(
    "SELECT * FROM orden_compra_items WHERE orden_compra_id = ? ORDER BY id",
    [ordenCompraId]
  );
  return filas;
}

async function eliminarPorOrden(pool, ordenCompraId) {
  await pool.query("DELETE FROM orden_compra_items WHERE orden_compra_id = ?", [ordenCompraId]);
}

module.exports = { insertarMuchos, listarPorOrden, eliminarPorOrden };
