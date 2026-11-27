const { z } = require("zod");
const { esquemaListado } = require("./listados");
const { TIPOS_SERVICIO } = require("../dominio/tiposServicio");

// Un filtro vacío equivale a no filtrar.
const vacioComoAusente = (valor) => (valor === "" ? undefined : valor);
const fecha = z.preprocess(
  vacioComoAusente,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: AAAA-MM-DD")
    .optional()
);
const id = z.preprocess(vacioComoAusente, z.coerce.number().int().positive().optional());

const listadoMaestroQuerySchema = esquemaListado({
  desde: fecha,
  hasta: fecha,
  cliente_id: id,
  tecnico_id: id,
  tipo_servicio: z.preprocess(vacioComoAusente, z.enum(TIPOS_SERVICIO).optional()),
  en_garantia: z.preprocess(vacioComoAusente, z.enum(["si", "no"]).optional()),
});

module.exports = { listadoMaestroQuerySchema };
