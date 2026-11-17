// Consulta paginada común a las listas: el mismo WHERE sirve para la página y
// para el total, así el paginador sabe cuántas páginas hay.

function aLimites({ pagina, tamanoPagina }) {
  return { limite: tamanoPagina, offset: (pagina - 1) * tamanoPagina };
}

// % y _ del texto buscado se escapan: "10%" busca literalmente "10%".
function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * columnas: lista SELECT; desde: FROM con sus JOIN.
 * condiciones/parametros: filtros fijos (p. ej. "x.deleted_at IS NULL").
 * q + buscarEn: búsqueda por texto (LIKE) en esas columnas, con OR.
 * filtros: { "x.estado": valor } (se omiten los valores vacíos).
 */
async function listarPaginado(
  pool,
  {
    columnas,
    desde,
    condiciones = [],
    parametros = [],
    q,
    buscarEn = [],
    filtros = {},
    orden,
    limite,
    offset,
  }
) {
  const donde = [...condiciones];
  const valores = [...parametros];
  for (const [columna, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === "") continue;
    donde.push(`${columna} = ?`);
    valores.push(valor);
  }
  if (q && buscarEn.length) {
    const patron = `%${escaparLike(q)}%`;
    donde.push(`(${buscarEn.map((c) => `${c} LIKE ?`).join(" OR ")})`);
    buscarEn.forEach(() => valores.push(patron));
  }
  const where = donde.length ? `WHERE ${donde.join(" AND ")}` : "";

  const [filas] = await pool.query(
    `SELECT ${columnas} ${desde} ${where} ORDER BY ${orden} LIMIT ? OFFSET ?`,
    [...valores, limite, offset]
  );
  const [conteo] = await pool.query(`SELECT COUNT(*) AS total ${desde} ${where}`, valores);
  return { filas, total: Number(conteo[0].total) };
}

module.exports = { aLimites, listarPaginado };
