const { listarPaginado } = require("./consultaListado");

// Lectura de la auditoría (la escribe servicios/auditoria.registrar). Más
// reciente primero; el mismo WHERE sirve para la página y para el total.
async function listar(
  pool,
  { limite, offset, q, desde, hasta, usuarioId, tabla, accion, registroId }
) {
  const condiciones = [];
  const parametros = [];
  if (desde) {
    condiciones.push("a.creado_en >= ?");
    parametros.push(desde);
  }
  if (hasta) {
    condiciones.push("a.creado_en < ? + INTERVAL 1 DAY");
    parametros.push(hasta);
  }
  return listarPaginado(pool, {
    columnas: `a.id, a.tabla, a.registro_id, a.accion, a.usuario_id, a.datos_anteriores,
               a.datos_nuevos, a.creado_en, u.nombre AS usuario_nombre`,
    desde: "FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id",
    condiciones,
    parametros,
    q,
    // el texto se busca en el nombre de quien hizo el cambio y en los datos
    // (códigos, nombres, descripciones)
    buscarEn: ["u.nombre", "a.datos_nuevos", "a.datos_anteriores"],
    filtros: {
      "a.usuario_id": usuarioId,
      "a.tabla": tabla,
      "a.accion": accion,
      "a.registro_id": registroId,
    },
    orden: "a.creado_en DESC, a.id DESC",
    limite,
    offset,
  });
}

module.exports = { listar };
