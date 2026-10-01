const express = require("express");
const { crearPool } = require("./config/db");
const { verificarConexion } = require("./servicios/estadoBaseDatos");
const { crearAuthRutas } = require("./rutas/authRutas");
const { crearClientesRutas } = require("./rutas/clientesRutas");
const { requireAuth } = require("./middlewares/requireAuth");
const { manejadorErrores } = require("./middlewares/manejadorErrores");

function crearApp() {
  const app = express();
  const APP_ENV = process.env.APP_ENV || "desconocido";
  const pool = crearPool();

  app.use(express.json());

  app.get("/", (req, res) => {
    res.json({
      proyecto: "SPEAL Project Control",
      estado: "funcionando",
      entorno: APP_ENV,
      hora_servidor: new Date().toISOString(),
    });
  });

  app.get("/health", (req, res) => {
    res.status(200).send("ok");
  });

  app.get("/health/db", async (req, res) => {
    try {
      await verificarConexion(pool);
      res.status(200).json({ estado: "ok" });
    } catch (error) {
      res.status(503).json({ estado: "error", mensaje: error.message });
    }
  });

  app.use("/auth", crearAuthRutas(pool));
  app.use("/clientes", requireAuth, crearClientesRutas(pool));

  app.use(manejadorErrores);

  return app;
}

module.exports = { crearApp };
