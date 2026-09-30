const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
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

app.listen(PORT, () => {
  console.log(`SPEAL Project Control (${APP_ENV}) escuchando en puerto ${PORT}`);
});
