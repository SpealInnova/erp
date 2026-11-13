const express = require("express");
const versionesServicio = require("../servicios/versiones");
const { listarVersionesParamsSchema } = require("../validaciones/versionesSchemas");
const { envolverAsync } = require("../middlewares/envolverAsync");

// Historial de versiones de un documento (para la vista previa de las
// versiones reemplazadas). Las nuevas versiones se crean en cada recurso:
// POST /<recurso>/:id/versiones.
function crearVersionesRutas(pool) {
  const router = express.Router();

  router.get(
    "/:tabla/:id",
    envolverAsync(async (req, res) => {
      const { tabla, id } = listarVersionesParamsSchema.parse(req.params);
      const versiones = await versionesServicio.listarVersiones(pool, tabla, id);
      res.status(200).json(versiones);
    })
  );

  return router;
}

module.exports = { crearVersionesRutas };
