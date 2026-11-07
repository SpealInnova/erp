class ErrorTablaNoPermitida extends Error {
  constructor() {
    super("No se permiten adjuntos para ese tipo de registro");
  }
}

class ErrorRegistroNoExiste extends Error {
  constructor() {
    super("El registro al que se intenta adjuntar el archivo no existe");
  }
}

class ErrorArchivoNoEncontrado extends Error {
  constructor() {
    super("Archivo adjunto no encontrado");
  }
}

class ErrorArchivoRequerido extends Error {
  constructor() {
    super("Debes adjuntar un archivo");
  }
}

class ErrorTipoArchivoNoPermitido extends Error {
  constructor() {
    super("Tipo de archivo no permitido. Solo se aceptan imágenes y PDF");
  }
}

module.exports = {
  ErrorTablaNoPermitida,
  ErrorRegistroNoExiste,
  ErrorArchivoNoEncontrado,
  ErrorArchivoRequerido,
  ErrorTipoArchivoNoPermitido,
};
