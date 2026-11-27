// "Hoy" del ERP: el día que es en Colombia, sin importar la zona del servidor
// (producción y staging corren en UTC: entre las 7 p. m. y la medianoche, el
// CURDATE() del servidor ya es mañana). Colombia está en UTC−5 todo el año.

const ZONA_COLOMBIA = "America/Bogota";

// Fecha de hoy en Colombia para las consultas, en lugar de CURDATE().
// UTC_TIMESTAMP() no depende de la zona de la sesión de MySQL.
const HOY_COLOMBIA_SQL = "DATE(UTC_TIMESTAMP() - INTERVAL 5 HOUR)";

const FORMATO_DIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_COLOMBIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// El día que es en Colombia en el instante `ahora`, como medianoche local del
// servidor: así se compara con las columnas DATE, que mysql2 entrega igual.
function hoyEnColombia(ahora = new Date()) {
  const partes = Object.fromEntries(FORMATO_DIA.formatToParts(ahora).map((p) => [p.type, p.value]));
  return new Date(Number(partes.year), Number(partes.month) - 1, Number(partes.day));
}

module.exports = { ZONA_COLOMBIA, HOY_COLOMBIA_SQL, hoyEnColombia };
