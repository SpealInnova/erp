const repo = require("../repositorios/listadoMaestroServiciosRepositorio");
const { aLimites } = require("../repositorios/consultaListado");
const { TEXTO_TIPO_SERVICIO } = require("../dominio/tiposServicio");
const { hoyEnColombia } = require("../dominio/fechaColombia");

// Listado Maestro de Servicios (FO-ST-006): todos los servicios técnicos con
// filtros, para consultar en pantalla o descargar en CSV (abre en Excel).

const MAXIMO_CSV = 5000;

function filtrosDe(query) {
  return {
    q: query.q,
    desde: query.desde,
    hasta: query.hasta,
    clienteId: query.cliente_id,
    tipoServicio: query.tipo_servicio,
    tecnicoId: query.tecnico_id,
    enGarantia: query.en_garantia === undefined ? undefined : query.en_garantia === "si",
  };
}

// Minutos entre hora_inicio y hora_fin ("HH:MM:SS"); null si falta una o el
// fin es anterior al inicio.
function duracionMinutos(inicio, fin) {
  if (!inicio || !fin) return null;
  const minutos = (hora) => {
    const [h, m] = String(hora).split(":").map(Number);
    return h * 60 + m;
  };
  const diferencia = minutos(fin) - minutos(inicio);
  return diferencia >= 0 ? diferencia : null;
}

function conCalculos(servicio) {
  return {
    ...servicio,
    tipo_servicio_texto: TEXTO_TIPO_SERVICIO[servicio.tipo_servicio] || servicio.tipo_servicio,
    duracion_minutos: duracionMinutos(servicio.hora_inicio, servicio.hora_fin),
  };
}

async function listarServicios(pool, query) {
  const { filas, total } = await repo.listar(pool, { ...aLimites(query), ...filtrosDe(query) });
  return { servicios: filas.map(conCalculos), total };
}

/* ---------- CSV ---------- */

// dd/mm/aaaa de una columna DATE (medianoche local, como la entrega mysql2).
function fechaTexto(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Separador ";" (el de Excel en español). Un texto que empieza por = + - @ se
// antepone con ' para que Excel no lo ejecute como fórmula.
function celdaCsv(valor) {
  if (valor === null || valor === undefined) return "";
  let texto = String(valor);
  if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const COLUMNAS_CSV = [
  ["Número", (s) => s.numero_reporte],
  ["Versión", (s) => s.version],
  ["Fecha de servicio", (s) => fechaTexto(s.fecha_servicio)],
  ["Cliente", (s) => s.cliente_nombre],
  ["N° de serie", (s) => s.equipo_numero_serie],
  ["Equipo", (s) => s.equipo_descripcion],
  ["Proyecto", (s) => `${s.proyecto_codigo} · ${s.proyecto_nombre}`],
  ["Tipo de servicio", (s) => s.tipo_servicio_texto],
  ["En garantía", (s) => (s.en_garantia ? "Sí" : "No")],
  ["Técnico", (s) => s.tecnico_nombre],
  ["Hora de inicio", (s) => (s.hora_inicio ? String(s.hora_inicio).slice(0, 5) : "")],
  ["Hora de fin", (s) => (s.hora_fin ? String(s.hora_fin).slice(0, 5) : "")],
  ["Duración (min)", (s) => s.duracion_minutos],
  ["Motivo", (s) => s.motivo],
];

// Devuelve { nombre, contenido, total, recortado }: el contenido lleva BOM para
// que Excel reconozca las tildes.
async function generarCsv(pool, query) {
  const { filas, total } = await repo.listar(pool, {
    limite: MAXIMO_CSV,
    offset: 0,
    ...filtrosDe(query),
  });
  const lineas = [
    COLUMNAS_CSV.map(([titulo]) => celdaCsv(titulo)).join(";"),
    ...filas
      .map(conCalculos)
      .map((s) => COLUMNAS_CSV.map(([, valor]) => celdaCsv(valor(s))).join(";")),
  ];
  const hoy = hoyEnColombia();
  const dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  return {
    nombre: `listado-maestro-servicios-${dia}.csv`,
    contenido: `\uFEFF${lineas.join("\r\n")}\r\n`,
    total,
    recortado: total > MAXIMO_CSV,
  };
}

module.exports = { listarServicios, generarCsv, duracionMinutos, celdaCsv, MAXIMO_CSV };
