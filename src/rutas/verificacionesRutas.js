const express = require("express");
const { crearVerificacionesControlador } = require("../controladores/verificacionesControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearVerificacionesRutas(pool) {
  const router = express.Router({ mergeParams: true });
  const controlador = crearVerificacionesControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearVerificacionesRutas };
