// El documento no se puede eliminar (tiene documentos enlazados o ya produjo
// efectos): se corrige con una nueva versión. "detalle" lleva lo que bloquea,
// para mostrarlo como vista previa.
class ErrorEliminacionBloqueada extends Error {
  constructor(mensaje, detalle = null) {
    super(mensaje);
    this.detalle = detalle;
  }
}

class ErrorTablaSinVersiones extends Error {
  constructor() {
    super("Ese tipo de documento no maneja versiones");
  }
}

module.exports = { ErrorEliminacionBloqueada, ErrorTablaSinVersiones };
