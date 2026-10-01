const express = require("express");
const { crearRequisicionesControlador } = require("../controladores/requisicionesControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearRequisicionesRutas(pool) {
  const router = express.Router();
  const controlador = crearRequisicionesControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.patch("/:id/estado", envolverAsync(controlador.cambiarEstado));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearRequisicionesRutas };
