const versionesRepositorio = require("../repositorios/versionesRepositorio");
const { ErrorTablaSinVersiones } = require("../dominio/erroresVersiones");

// Nueva versión editable de un documento: se guarda una copia completa del
// documento tal como está (versión vigente, que pasa a "reemplazada"), se
// aplica la corrección sobre el mismo registro y se sube el número de versión.
// Como el registro es el mismo, sus documentos enlazados pasan a la versión
// nueva. Todo en una transacción: si la corrección no es válida, no queda nada.
async function enTransaccion(pool, fn) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await fn(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

// obtener(conexion): el documento completo (con ítems) para la copia.
// actualizar(conexion, anterior): aplica la corrección con sus validaciones.
async function crearNuevaVersion(
  pool,
  { tabla, registroId, motivo, usuarioId, obtener, actualizar }
) {
  return enTransaccion(pool, async (conexion) => {
    const anterior = await obtener(conexion);
    const versionActual = Number(anterior.version) || 1;
    await versionesRepositorio.registrar(conexion, {
      tabla,
      registroId,
      version: versionActual,
      instantanea: anterior,
      motivo,
      usuarioId,
    });
    await actualizar(conexion, anterior);
    await versionesRepositorio.fijarVersion(conexion, tabla, registroId, versionActual + 1);
    return versionActual + 1;
  });
}

async function listarVersiones(pool, tabla, registroId) {
  if (!versionesRepositorio.TABLAS_VERSIONADAS.includes(tabla)) {
    throw new ErrorTablaSinVersiones();
  }
  const [vigente, anteriores] = await Promise.all([
    versionesRepositorio.versionVigente(pool, tabla, registroId),
    versionesRepositorio.listar(pool, tabla, registroId),
  ]);
  return { version_vigente: vigente, anteriores };
}

module.exports = {
  crearNuevaVersion,
  listarVersiones,
  TABLAS_VERSIONADAS: versionesRepositorio.TABLAS_VERSIONADAS,
};
