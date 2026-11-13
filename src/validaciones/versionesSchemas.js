const { z } = require("zod");
const { TABLAS_VERSIONADAS } = require("../repositorios/versionesRepositorio");

// Toda nueva versión explica por qué se corrige el documento.
const motivoVersion = z.string().trim().min(5, "Explica el motivo de la nueva versión").max(500);

// Esquema de nueva versión: los mismos campos de la edición, más el motivo.
function conMotivo(esquemaActualizar) {
  return esquemaActualizar.extend({ motivo: motivoVersion });
}

const listarVersionesParamsSchema = z.object({
  tabla: z.enum(TABLAS_VERSIONADAS),
  id: z.coerce.number().int().positive(),
});

module.exports = { conMotivo, listarVersionesParamsSchema };
