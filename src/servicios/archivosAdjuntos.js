const archivosAdjuntosRepositorio = require("../repositorios/archivosAdjuntosRepositorio");
const archivosDrive = require("./archivosDrive");
const proyectoCarpetasDrive = require("./proyectoCarpetasDrive");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const proyectoActividadesRepositorio = require("../repositorios/proyectoActividadesRepositorio");
const requisicionesRepositorio = require("../repositorios/requisicionesRepositorio");
const ordenesCompraRepositorio = require("../repositorios/ordenesCompraRepositorio");
const auditoria = require("./auditoria");
const {
  ErrorTablaNoPermitida,
  ErrorRegistroNoExiste,
  ErrorArchivoNoEncontrado,
  ErrorTipoArchivoNoPermitido,
} = require("../dominio/erroresArchivosAdjuntos");

const TABLA = "archivos_adjuntos";

const VERIFICADORES_POR_TABLA = {
  proyectos: proyectosRepositorio.obtenerPorId,
  proyecto_actividades: proyectoActividadesRepositorio.obtenerPorId,
  requisiciones: requisicionesRepositorio.obtenerPorId,
  ordenes_compra: ordenesCompraRepositorio.obtenerPorId,
};

const MIME_TYPES_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

async function verificarRegistroExiste(pool, tabla, registroId) {
  const verificador = VERIFICADORES_POR_TABLA[tabla];
  if (!verificador) {
    throw new ErrorTablaNoPermitida();
  }
  const registroPadre = await verificador(pool, registroId);
  if (!registroPadre) {
    throw new ErrorRegistroNoExiste();
  }
  return registroPadre;
}

async function subirArchivo(pool, { tabla, registroId, archivo }, usuarioId) {
  const registroPadre = await verificarRegistroExiste(pool, tabla, registroId);

  if (!MIME_TYPES_PERMITIDOS.includes(archivo.mimetype)) {
    throw new ErrorTipoArchivoNoPermitido();
  }

  const nombreArchivo = Buffer.from(archivo.originalname, "latin1").toString("utf8");
  const carpetaId = await proyectoCarpetasDrive.obtenerCarpetaParaArchivo(pool, {
    tabla,
    registro: registroPadre,
  });

  const { driveFileId, driveEnlace } = await archivosDrive.subirArchivo({
    nombre: nombreArchivo,
    mimeType: archivo.mimetype,
    buffer: archivo.buffer,
    parentId: carpetaId,
  });

  const id = await archivosAdjuntosRepositorio.crear(pool, {
    tabla,
    registroId,
    nombreArchivo,
    mimeType: archivo.mimetype,
    tamanoBytes: archivo.size,
    driveFileId,
    driveEnlace,
    subidoPor: usuarioId,
  });
  const registro = await archivosAdjuntosRepositorio.obtenerPorId(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "crear",
    usuarioId,
    datosAnteriores: null,
    datosNuevos: registro,
  });

  return registro;
}

async function listarArchivos(pool, tabla, registroId) {
  await verificarRegistroExiste(pool, tabla, registroId);
  return archivosAdjuntosRepositorio.listarPorRegistro(pool, tabla, registroId);
}

async function eliminarArchivo(pool, id, usuarioId) {
  const archivo = await archivosAdjuntosRepositorio.obtenerPorId(pool, id);
  if (!archivo) {
    throw new ErrorArchivoNoEncontrado();
  }

  await archivosAdjuntosRepositorio.softDelete(pool, id);

  await auditoria.registrar(pool, {
    tabla: TABLA,
    registroId: id,
    accion: "eliminar",
    usuarioId,
    datosAnteriores: archivo,
    datosNuevos: null,
  });
}

module.exports = { subirArchivo, listarArchivos, eliminarArchivo };
