const express = require("express");
const {
  crearProyectoEquipoControlador,
} = require("../controladores/proyectoEquipoControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearProyectoEquipoRutas(pool) {
  const router = express.Router({ mergeParams: true });
  const controlador = crearProyectoEquipoControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearProyectoEquipoRutas };
