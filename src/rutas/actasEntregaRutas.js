const express = require("express");
const { crearActasEntregaControlador } = require("../controladores/actasEntregaControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearActasEntregaRutas(pool) {
  const router = express.Router();
  const controlador = crearActasEntregaControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearActasEntregaRutas };
