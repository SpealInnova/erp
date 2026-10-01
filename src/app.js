const express = require("express");
const { crearPool } = require("./config/db");
const { verificarConexion } = require("./servicios/estadoBaseDatos");
const { crearAuthRutas } = require("./rutas/authRutas");
const { crearClientesRutas } = require("./rutas/clientesRutas");
const { crearProyectosRutas } = require("./rutas/proyectosRutas");
const { crearCotizacionesRutas } = require("./rutas/cotizacionesRutas");
const { crearProveedoresRutas } = require("./rutas/proveedoresRutas");
const { crearRequisicionesRutas } = require("./rutas/requisicionesRutas");
const { crearOrdenesCompraRutas } = require("./rutas/ordenesCompraRutas");
const { crearExpedientesDisenoRutas } = require("./rutas/expedientesDisenoRutas");
const { crearRequisitosEntradaRutas } = require("./rutas/requisitosEntradaRutas");
const { crearSalidasDisenoRutas } = require("./rutas/salidasDisenoRutas");
const { crearVerificacionesRutas } = require("./rutas/verificacionesRutas");
const { crearValidacionesRutas } = require("./rutas/validacionesRutas");
const { crearRevisionesDisenoRutas } = require("./rutas/revisionesDisenoRutas");
const { crearRiesgosDisenoRutas } = require("./rutas/riesgosDisenoRutas");
const { crearCambiosDisenoRutas } = require("./rutas/cambiosDisenoRutas");
const { crearTransferenciasRutas } = require("./rutas/transferenciasRutas");
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
  app.use("/proyectos", requireAuth, crearProyectosRutas(pool));
  app.use("/cotizaciones", requireAuth, crearCotizacionesRutas(pool));
  app.use("/proveedores", requireAuth, crearProveedoresRutas(pool));
  app.use("/requisiciones", requireAuth, crearRequisicionesRutas(pool));
  app.use("/ordenes-compra", requireAuth, crearOrdenesCompraRutas(pool));
  app.use("/expedientes-diseno", requireAuth, crearExpedientesDisenoRutas(pool));
  app.use(
    "/expedientes-diseno/:expedienteId/requisitos-entrada",
    requireAuth,
    crearRequisitosEntradaRutas(pool)
  );
  app.use(
    "/expedientes-diseno/:expedienteId/salidas-diseno",
    requireAuth,
    crearSalidasDisenoRutas(pool)
  );
  app.use(
    "/expedientes-diseno/:expedienteId/verificaciones",
    requireAuth,
    crearVerificacionesRutas(pool)
  );
  app.use(
    "/expedientes-diseno/:expedienteId/validaciones",
    requireAuth,
    crearValidacionesRutas(pool)
  );
  app.use(
    "/expedientes-diseno/:expedienteId/revisiones-diseno",
    requireAuth,
    crearRevisionesDisenoRutas(pool)
  );
  app.use(
    "/expedientes-diseno/:expedienteId/riesgos-diseno",
    requireAuth,
    crearRiesgosDisenoRutas(pool)
  );
  app.use(
    "/expedientes-diseno/:expedienteId/cambios-diseno",
    requireAuth,
    crearCambiosDisenoRutas(pool)
  );
  app.use(
    "/expedientes-diseno/:expedienteId/transferencias",
    requireAuth,
    crearTransferenciasRutas(pool)
  );

  app.use(manejadorErrores);

  return app;
}

module.exports = { crearApp };
