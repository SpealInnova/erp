const express = require("express");
const multer = require("multer");
const {
  crearArchivosAdjuntosControlador,
} = require("../controladores/archivosAdjuntosControlador");
const { envolverAsync } = require("../middlewares/envolverAsync");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function crearArchivosAdjuntosRutas(pool) {
  const router = express.Router();
  const controlador = crearArchivosAdjuntosControlador(pool);

  router.post("/", upload.single("archivo"), envolverAsync(controlador.subir));
  router.get("/", envolverAsync(controlador.listar));
  router.delete("/:id", envolverAsync(controlador.eliminar));

  return router;
}

module.exports = { crearArchivosAdjuntosRutas };
