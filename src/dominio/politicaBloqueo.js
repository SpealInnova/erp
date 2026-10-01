const LIMITE_INTENTOS = 5;
const DURACION_BLOQUEO_MIN = 15;

function estaBloqueado(usuario, ahora = new Date()) {
  if (!usuario.bloqueado_hasta) {
    return false;
  }
  return new Date(usuario.bloqueado_hasta) > ahora;
}

function calcularTrasIntentoFallido(intentosActuales, ahora = new Date()) {
  const intentos = intentosActuales + 1;
  if (intentos >= LIMITE_INTENTOS) {
    const bloqueadoHasta = new Date(ahora.getTime() + DURACION_BLOQUEO_MIN * 60000);
    return { intentos, bloqueadoHasta };
  }
  return { intentos, bloqueadoHasta: null };
}

module.exports = { LIMITE_INTENTOS, DURACION_BLOQUEO_MIN, estaBloqueado, calcularTrasIntentoFallido };
