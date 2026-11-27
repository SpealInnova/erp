const { z } = require("zod");
const { ESTADOS } = require("../dominio/estadoProyecto");

// Cualquier etapa del flujo; "cancelado" no es una etapa.
const FASES = Object.values(ESTADOS).filter((f) => f !== ESTADOS.CANCELADO);

const asignarResponsableSchema = z.object({
  fase: z.enum(FASES),
  usuario_id: z.coerce.number().int().positive(),
});

module.exports = { asignarResponsableSchema };
