const express = require("express");
const { crearProyectosControlador } = require("../controladores/proyectosControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearProyectosRutas(pool) {
  const router = express.Router();
  const controlador = crearProyectosControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.patch("/:id/estado", envolverAsync(controlador.cambiarEstado));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearProyectosRutas };
