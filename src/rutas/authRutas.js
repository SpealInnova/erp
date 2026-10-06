const express = require("express");
const { crearAuthControlador } = require("../controladores/authControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");
const { requireAuth } = require("../middlewares/requireAuth");

function crearAuthRutas(pool) {
  const router = express.Router();
  const controlador = crearAuthControlador(pool);

  router.post("/login", envolverAsync(controlador.login));
  router.post("/solicitar-recuperacion", envolverAsync(controlador.solicitarRecuperacion));
  router.post("/restablecer-password", envolverAsync(controlador.restablecerPassword));
  router.get("/perfil", requireAuth, envolverAsync(controlador.perfil));

  return router;
}

module.exports = { crearAuthRutas };
