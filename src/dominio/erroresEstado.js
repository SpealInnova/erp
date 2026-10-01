class ErrorTransicionInvalida extends Error {
  constructor(estadoActual, estadoDestino) {
    super(`Transición no permitida: ${estadoActual} -> ${estadoDestino}`);
    this.estadoActual = estadoActual;
    this.estadoDestino = estadoDestino;
  }
}

module.exports = { ErrorTransicionInvalida };
