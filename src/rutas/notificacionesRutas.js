const express = require("express");
const { crearNotificacionesControlador } = require("../controladores/notificacionesControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

function crearNotificacionesRutas(pool) {
  const router = express.Router();
  const controlador = crearNotificacionesControlador(pool);

  router.get("/", envolverAsync(controlador.listar));
  router.patch("/leer-todas", envolverAsync(controlador.marcarTodasLeidas));
  router.patch("/:id/leida", envolverAsync(controlador.marcarLeida));

  return router;
}

module.exports = { crearNotificacionesRutas };
