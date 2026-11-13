const path = require("path");
const express = require("express");
const { crearPool } = require("./config/db");
const { verificarConexion } = require("./servicios/estadoBaseDatos");
const { crearAuthRutas } = require("./rutas/authRutas");
const { crearClientesRutas } = require("./rutas/clientesRutas");
const { crearProyectosRutas } = require("./rutas/proyectosRutas");
const { crearProyectoActividadesRutas } = require("./rutas/proyectoActividadesRutas");
const { crearLineaTiempoRutas } = require("./rutas/lineaTiempoRutas");
const { crearProyectoEquipoRutas } = require("./rutas/proyectoEquipoRutas");
const { crearProyectoDocumentosRutas } = require("./rutas/proyectoDocumentosRutas");
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
const {
  crearReportesServicioTecnicoRutas,
} = require("./rutas/reportesServicioTecnicoRutas");
const { crearParametrosMedidosRutas } = require("./rutas/parametrosMedidosRutas");
const { crearActasCierreRutas } = require("./rutas/actasCierreRutas");
const { crearActasEntregaRutas } = require("./rutas/actasEntregaRutas");
const { crearUsuariosRutas } = require("./rutas/usuariosRutas");
const { crearNotificacionesRutas } = require("./rutas/notificacionesRutas");
const { crearArchivosAdjuntosRutas } = require("./rutas/archivosAdjuntosRutas");
const { crearTablerosRutas } = require("./rutas/tablerosRutas");
const { crearEquiposRutas } = require("./rutas/equiposRutas");
const { requireAuth } = require("./middlewares/requireAuth");
const { manejadorErrores } = require("./middlewares/manejadorErrores");

function crearApp() {
  const app = express();
  const APP_ENV = process.env.APP_ENV || "desconocido";
  const pool = crearPool();

  app.use(express.json());

  app.get("/", (req, res) => {
    res.redirect("/login");
  });

  app.get("/estado", (req, res) => {
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

  const carpetaPublica = path.join(__dirname, "public");
  app.use(express.static(carpetaPublica));
  app.get("/login", (req, res) => res.sendFile(path.join(carpetaPublica, "login.html")));
  app.get("/restablecer-password", (req, res) =>
    res.sendFile(path.join(carpetaPublica, "restablecer-password.html"))
  );
  app.get("/inicio", (req, res) => res.sendFile(path.join(carpetaPublica, "inicio.html")));

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
  app.use(
    "/proyectos/:proyectoId/actividades",
    requireAuth,
    crearProyectoActividadesRutas(pool)
  );
  app.use(
    "/proyectos/:proyectoId/linea-tiempo",
    requireAuth,
    crearLineaTiempoRutas(pool)
  );
  app.use(
    "/proyectos/:proyectoId/equipo",
    requireAuth,
    crearProyectoEquipoRutas(pool)
  );
  app.use(
    "/proyectos/:proyectoId/documentos",
    requireAuth,
    crearProyectoDocumentosRutas(pool)
  );
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
  app.use(
    "/reportes-servicio-tecnico",
    requireAuth,
    crearReportesServicioTecnicoRutas(pool)
  );
  app.use(
    "/reportes-servicio-tecnico/:reporteId/parametros-medidos",
    requireAuth,
    crearParametrosMedidosRutas(pool)
  );
  app.use("/actas-cierre-satisfaccion", requireAuth, crearActasCierreRutas(pool));
  app.use("/actas-entrega-equipos", requireAuth, crearActasEntregaRutas(pool));
  app.use("/usuarios", requireAuth, crearUsuariosRutas(pool));
  app.use("/notificaciones", requireAuth, crearNotificacionesRutas(pool));
  app.use("/archivos-adjuntos", requireAuth, crearArchivosAdjuntosRutas(pool));
  app.use("/tableros", requireAuth, crearTablerosRutas(pool));
  app.use("/equipos", requireAuth, crearEquiposRutas(pool));

  app.use(manejadorErrores);

  return app;
}

module.exports = { crearApp };
