const express = require("express");
const { envolverAsync } = require("../middlewares/envolverAsync");
const { obtenerResumenEtapas } = require("../servicios/resumenEtapas");

// Resumen de cada etapa (fase) de un proyecto: plan, tiempo real, avance,
// prioridades, vencimientos y evidencias. Solo lectura.
function crearResumenEtapasRutas(pool) {
  const router = express.Router({ mergeParams: true });
  router.get(
    "/",
    envolverAsync(async (req, res) => {
      const resumen = await obtenerResumenEtapas(pool, Number(req.params.proyectoId));
      res.status(200).json(resumen);
    })
  );
  return router;
}

module.exports = { crearResumenEtapasRutas };
