const transicionesRepositorio = require("../repositorios/transicionesRepositorio");
const { ESTADOS_TRABAJO } = require("../dominio/trabajo");

// Guarda un cambio de estado (actividad, tarea o fase de proyecto). Es la
// base de los tiempos de los procesos: no mide tiempo conectado, sino cuánto
// tarda cada paso. No guarda nada si el estado no cambió.
async function registrar(
  pool,
  { entidad, registroId, proyectoId, estadoAnterior, estadoNuevo, usuarioId }
) {
  if (!estadoNuevo || estadoAnterior === estadoNuevo) return;
  await transicionesRepositorio.registrar(pool, {
    entidad,
    registroId,
    proyectoId,
    estadoAnterior,
    estadoNuevo,
    usuarioId,
  });
}

// Segundos que un registro estuvo "en curso": suma de los tramos que
// empiezan al pasar a en_curso y terminan con el siguiente cambio. Si sigue
// en curso, el último tramo corre hasta `ahora`.
function segundosEnCurso(transiciones, ahora = new Date()) {
  let total = 0;
  let desde = null;
  transiciones.forEach((t) => {
    const momento = new Date(t.created_at);
    if (desde && t.estado_nuevo !== ESTADOS_TRABAJO.EN_CURSO) {
      total += (momento - desde) / 1000;
      desde = null;
    }
    if (t.estado_nuevo === ESTADOS_TRABAJO.EN_CURSO && !desde) desde = momento;
  });
  if (desde) total += (ahora - desde) / 1000;
  return Math.max(0, Math.round(total));
}

// { registro_id: segundos en curso } para varios registros de una entidad.
async function segundosEnCursoPorRegistro(pool, entidad, registroIds, ahora = new Date()) {
  const filas = await transicionesRepositorio.listarPorRegistros(pool, entidad, registroIds);
  const porRegistro = new Map();
  filas.forEach((f) => {
    if (!porRegistro.has(f.registro_id)) porRegistro.set(f.registro_id, []);
    porRegistro.get(f.registro_id).push(f);
  });
  const resultado = {};
  registroIds.forEach((id) => {
    resultado[id] = segundosEnCurso(porRegistro.get(id) || [], ahora);
  });
  return resultado;
}

module.exports = { registrar, segundosEnCurso, segundosEnCursoPorRegistro };
