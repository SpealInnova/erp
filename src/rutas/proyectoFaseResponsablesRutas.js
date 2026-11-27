const express = require("express");
const {
  crearProyectoFaseResponsablesControlador,
} = require("../controladores/proyectoFaseResponsablesControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

// /proyectos/:proyectoId/fase-responsables
function crearProyectoFaseResponsablesRutas(pool) {
  const router = express.Router({ mergeParams: true });
  const controlador = crearProyectoFaseResponsablesControlador(pool);

  router.get("/", envolverAsync(controlador.listar));
  router.post("/", envolverAsync(controlador.crear));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearProyectoFaseResponsablesRutas };
