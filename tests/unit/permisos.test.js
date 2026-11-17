const { PERMISOS, CLAVES, tienePermiso, permisosDe } = require("../../src/dominio/permisos");
const { CARGOS } = require("../../src/dominio/catalogoCargos");

const usuario = (cargo, extra = {}) => ({ id: 1, rol: "tester", cargo, activo: 1, ...extra });

describe("Matriz de permisos por cargo", () => {
  test("cada cargo de la matriz existe en el catálogo", () => {
    Object.values(PERMISOS)
      .flat()
      .forEach((cargo) => expect(CARGOS).toContain(cargo));
  });

  test("el Gerente General y el rol admin tienen todos los permisos", () => {
    expect(permisosDe(usuario("Gerente General"))).toEqual(CLAVES);
    expect(permisosDe(usuario(null, { rol: "admin" }))).toEqual(CLAVES);
  });

  test("cada cargo tiene solo los permisos de su fila", () => {
    expect(tienePermiso(usuario("Director Administrativo y Financiero"), "aprobar_oc")).toBe(true);
    expect(tienePermiso(usuario("Coordinador de Compras"), "aprobar_oc")).toBe(false);
    expect(tienePermiso(usuario("Coordinador de Compras"), "versionar_oc")).toBe(true);
    expect(tienePermiso(usuario("Jefe de I+D+i"), "aprobar_diseno")).toBe(true);
    expect(permisosDe(usuario("Técnico Mantenimiento y Ensamble"))).toEqual([]);
    expect(permisosDe(usuario(null))).toEqual([]);
  });

  test("compara el cargo sin importar tildes, mayúsculas ni espacios", () => {
    expect(tienePermiso(usuario("Jefe de Producción e Instalaciones"), "versionar_acta")).toBe(
      true
    );
    expect(tienePermiso(usuario("  director administrativo  y financiero "), "aprobar_oc")).toBe(
      true
    );
    expect(permisosDe(usuario("GERENTE GENERAL"))).toEqual(CLAVES);
    expect(tienePermiso(usuario("Gestor de Proyectos"), "versionar_proyecto")).toBe(false);
  });

  test("un usuario inactivo o inexistente no tiene permisos", () => {
    expect(permisosDe(usuario("Gerente General", { activo: 0 }))).toEqual([]);
    expect(permisosDe(null)).toEqual([]);
  });

  test("un permiso desconocido es un error de programación", () => {
    expect(() => tienePermiso(usuario("Gerente General"), "aprobar_todo")).toThrow(/desconocido/);
  });
});
