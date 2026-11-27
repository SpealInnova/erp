const { listarPaginado } = require("./consultaListado");

// Listado Maestro de Servicios (FO-ST-006): consulta sobre los reportes de
// servicio técnico, no una tabla aparte (nota de gobierno del diccionario).

// Día del servicio; si el reporte no lo tiene, el de su creación.
const FECHA = "COALESCE(r.fecha_servicio, DATE(r.created_at))";

const COLUMNAS = `r.id, r.numero_reporte, r.version, r.fecha_servicio, r.hora_inicio, r.hora_fin,
  r.tipo_servicio, r.en_garantia, r.motivo, r.equipo_numero_serie, r.tecnico_responsable_id,
  ${FECHA} AS fecha, e.descripcion AS equipo_descripcion, c.nombre_razon_social AS cliente_nombre,
  p.codigo_pry AS proyecto_codigo, p.nombre_proyecto AS proyecto_nombre, u.nombre AS tecnico_nombre`;

const DESDE = `FROM reportes_servicio_tecnico r
  JOIN proyectos p ON p.id = r.proyecto_id
  JOIN clientes c ON c.id = r.cliente_id
  LEFT JOIN usuarios u ON u.id = r.tecnico_responsable_id
  LEFT JOIN equipos e ON e.numero_serie = r.equipo_numero_serie AND e.deleted_at IS NULL`;

/**
 * filtros: desde / hasta (AAAA-MM-DD, sobre la fecha del servicio), clienteId,
 * tipoServicio, tecnicoId, enGarantia (true/false) y q (número, serie,
 * equipo, cliente, proyecto o técnico). Más recientes primero.
 */
async function listar(pool, { limite, offset, q, desde, hasta, ...filtros }) {
  const condiciones = ["r.deleted_at IS NULL"];
  const parametros = [];
  if (desde) {
    condiciones.push(`${FECHA} >= ?`);
    parametros.push(desde);
  }
  if (hasta) {
    condiciones.push(`${FECHA} <= ?`);
    parametros.push(hasta);
  }
  return listarPaginado(pool, {
    columnas: COLUMNAS,
    desde: DESDE,
    condiciones,
    parametros,
    filtros: {
      "r.cliente_id": filtros.clienteId,
      "r.tipo_servicio": filtros.tipoServicio,
      "r.tecnico_responsable_id": filtros.tecnicoId,
      "r.en_garantia": filtros.enGarantia === undefined ? undefined : Number(filtros.enGarantia),
    },
    q,
    buscarEn: [
      "r.numero_reporte",
      "r.equipo_numero_serie",
      "e.descripcion",
      "c.nombre_razon_social",
      "p.codigo_pry",
      "p.nombre_proyecto",
      "u.nombre",
    ],
    orden: `${FECHA} DESC, r.id DESC`,
    limite,
    offset,
  });
}

module.exports = { listar };
