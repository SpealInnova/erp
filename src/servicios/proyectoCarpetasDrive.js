const archivosDrive = require("./archivosDrive");
const proyectosRepositorio = require("../repositorios/proyectosRepositorio");
const requisicionesRepositorio = require("../repositorios/requisicionesRepositorio");
const proyectoDriveCarpetasRepositorio = require("../repositorios/proyectoDriveCarpetasRepositorio");

async function resolverProyectoYFase(pool, tabla, registro) {
  if (tabla === "proyectos") {
    return { proyectoId: registro.id, fase: registro.estado, proyecto: registro };
  }
  if (tabla === "proyecto_actividades") {
    const proyecto = await proyectosRepositorio.obtenerPorId(pool, registro.proyecto_id);
    return { proyectoId: registro.proyecto_id, fase: registro.fase, proyecto };
  }
  if (tabla === "requisiciones") {
    const proyecto = await proyectosRepositorio.obtenerPorId(pool, registro.proyecto_id);
    return { proyectoId: registro.proyecto_id, fase: proyecto.estado, proyecto };
  }
  if (tabla === "ordenes_compra") {
    const requisicion = await requisicionesRepositorio.obtenerPorId(pool, registro.requisicion_id);
    const proyecto = await proyectosRepositorio.obtenerPorId(pool, requisicion.proyecto_id);
    return { proyectoId: requisicion.proyecto_id, fase: proyecto.estado, proyecto };
  }
  throw new Error(`Tabla no soportada para carpetas de Drive: ${tabla}`);
}

async function obtenerOCrearCarpetaProyecto(pool, proyecto) {
  if (proyecto.drive_folder_id) {
    return proyecto.drive_folder_id;
  }
  const carpeta = await archivosDrive.crearCarpeta({
    nombre: proyecto.codigo_pry,
    parentId: process.env.DRIVE_FOLDER_ID,
  });
  await proyectosRepositorio.actualizar(pool, proyecto.id, { drive_folder_id: carpeta.id });
  return carpeta.id;
}

async function obtenerOCrearCarpetaFase(pool, proyectoId, fase, carpetaProyectoId) {
  const existente = await proyectoDriveCarpetasRepositorio.obtenerPorProyectoYFase(
    pool,
    proyectoId,
    fase
  );
  if (existente) {
    return existente.drive_folder_id;
  }
  const carpeta = await archivosDrive.crearCarpeta({ nombre: fase, parentId: carpetaProyectoId });
  await proyectoDriveCarpetasRepositorio.crear(pool, {
    proyectoId,
    fase,
    driveFolderId: carpeta.id,
  });
  return carpeta.id;
}

async function obtenerCarpetaParaArchivo(pool, { tabla, registro }) {
  const { proyectoId, fase, proyecto } = await resolverProyectoYFase(pool, tabla, registro);
  const carpetaProyectoId = await obtenerOCrearCarpetaProyecto(pool, proyecto);
  return obtenerOCrearCarpetaFase(pool, proyectoId, fase, carpetaProyectoId);
}

module.exports = { obtenerCarpetaParaArchivo };
