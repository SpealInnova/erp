const { z } = require("zod");
const { esquemaListado } = require("./listados");

const vacioComoAusente = (valor) => (valor === "" ? undefined : valor);
const fecha = z.preprocess(
  vacioComoAusente,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha con formato AAAA-MM-DD")
    .optional()
);
const entero = z.preprocess(vacioComoAusente, z.coerce.number().int().positive().optional());

// Filtros de la pantalla de auditoría, sobre los comunes de las listas.
const listarAuditoriaSchema = esquemaListado({
  desde: fecha,
  hasta: fecha,
  usuario_id: entero,
  tabla: z.preprocess(
    vacioComoAusente,
    z
      .string()
      .regex(/^[a-z_]{1,60}$/)
      .optional()
  ),
  accion: z.preprocess(vacioComoAusente, z.enum(["crear", "actualizar", "eliminar"]).optional()),
  registro_id: entero,
});

module.exports = { listarAuditoriaSchema };
