const express = require("express");

function crearApp() {
  const app = express();
  const APP_ENV = process.env.APP_ENV || "desconocido";

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

  return app;
}

module.exports = { crearApp };
