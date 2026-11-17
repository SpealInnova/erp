const { z } = require("zod");

// Parámetros comunes de las listas: página, tamaño (máximo 100, el que usan
// los selectores) y texto de búsqueda. Un texto vacío equivale a no buscar.
const vacioComoAusente = (valor) => (valor === "" ? undefined : valor);

const CAMPOS_LISTADO = {
  pagina: z.coerce.number().int().min(1).optional().default(1),
  tamanoPagina: z.coerce.number().int().min(1).max(100).optional().default(20),
  q: z.preprocess(vacioComoAusente, z.string().trim().max(100).optional()),
};

function esquemaListado(extra = {}) {
  return z.object({ ...CAMPOS_LISTADO, ...extra });
}

// Filtro opcional por estado, limitado a los valores del dominio.
function filtroEstado(ESTADOS) {
  return { estado: z.preprocess(vacioComoAusente, z.enum(Object.values(ESTADOS)).optional()) };
}

module.exports = { esquemaListado, filtroEstado };
