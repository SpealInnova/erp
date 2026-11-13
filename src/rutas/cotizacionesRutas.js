const express = require("express");
const { crearCotizacionesControlador } = require("../controladores/cotizacionesControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearCotizacionesRutas(pool) {
  const router = express.Router();
  const controlador = crearCotizacionesControlador(pool);

  router.post("/", envolverAsync(controlador.crear));
  router.get("/", envolverAsync(controlador.listar));
  router.get("/:id", envolverAsync(controlador.obtener));
  router.put("/:id", envolverAsync(controlador.actualizar));
  router.post("/:id/versiones", envolverAsync(controlador.crearVersion));
  router.patch("/:id/estado", envolverAsync(controlador.cambiarEstado));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearCotizacionesRutas };
