const express = require("express");
const { envolverAsync } = require("../middlewares/envolverAsync");
const { listarAuditoriaSchema } = require("../validaciones/auditoriaSchemas");
const { listarAuditoria } = require("../servicios/auditoriaConsulta");

// Solo lectura. El permiso (ver_auditoria) lo exige el servicio.
function crearAuditoriaRutas(pool) {
  const router = express.Router();

  router.get(
    "/",
    envolverAsync(async (req, res) => {
      const filtros = listarAuditoriaSchema.parse(req.query);
      res.status(200).json(await listarAuditoria(pool, req.usuario.id, filtros));
    })
  );

  return router;
}

module.exports = { crearAuditoriaRutas };
