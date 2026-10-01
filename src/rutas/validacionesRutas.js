const express = require("express");
const { crearValidacionesControlador } = require("../controladores/validacionesControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearValidacionesRutas(pool) {
  const router = express.Router({ mergeParams: true });
  const controlador = crearValidacionesControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearValidacionesRutas };
