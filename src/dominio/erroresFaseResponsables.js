class ErrorResponsableYaAsignado extends Error {
  constructor() {
    super("Esa persona ya es responsable de esta etapa");
  }
}

class ErrorResponsableEtapaNoEncontrado extends Error {
  constructor() {
    super("Responsable de etapa no encontrado");
  }
}

class ErrorResponsableEtapaInvalido extends Error {
  constructor() {
    super("La persona indicada no existe o está inactiva");
  }
}

module.exports = {
  ErrorResponsableYaAsignado,
  ErrorResponsableEtapaNoEncontrado,
  ErrorResponsableEtapaInvalido,
};
