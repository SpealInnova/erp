const express = require("express");
const { crearClientesControlador } = require("../controladores/clientesControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearClientesRutas(pool) {
  const router = express.Router();
  const controlador = crearClientesControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearClientesRutas };
