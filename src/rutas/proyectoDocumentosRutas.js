const express = require("express");
const {
  crearProyectoDocumentosControlador,
} = require("../controladores/proyectoDocumentosControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

// Documentos de los demás módulos enlazados a un proyecto (solo lectura).
function crearProyectoDocumentosRutas(pool) {
  const router = express.Router({ mergeParams: true });
  const controlador = crearProyectoDocumentosControlador(pool);

  router.get("/", envolverAsync(controlador.listar));

  return router;
}

module.exports = { crearProyectoDocumentosRutas };
