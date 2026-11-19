const express = require("express");
const { envolverAsync } = require("../middlewares/envolverAsync");
const { exigirPermiso } = require("../servicios/autorizacion");
const copias = require("../servicios/copiasSeguridad");

// Panel de copias de seguridad: el registro de copias y "Hacer copia ahora".
// Solo admin y Gerente General (permiso gestionar_copias).
function crearCopiasRutas(pool) {
  const router = express.Router();

  router.get(
    "/",
    envolverAsync(async (req, res) => {
      await exigirPermiso(pool, req.usuario.id, "gestionar_copias");
      res.status(200).json(await copias.listarCopias(pool));
    })
  );

  router.post(
    "/",
    envolverAsync(async (req, res) => {
      await exigirPermiso(pool, req.usuario.id, "gestionar_copias");
      const copia = await copias.hacerCopia(pool, { origen: "manual", usuarioId: req.usuario.id });
      res.status(201).json({ copia });
    })
  );

  return router;
}

module.exports = { crearCopiasRutas };
