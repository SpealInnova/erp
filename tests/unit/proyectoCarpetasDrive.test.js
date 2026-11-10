jest.mock("../../src/servicios/archivosDrive");
jest.mock("../../src/repositorios/proyectosRepositorio");
jest.mock("../../src/repositorios/requisicionesRepositorio");
jest.mock("../../src/repositorios/proyectoDriveCarpetasRepositorio");

const archivosDrive = require("../../src/servicios/archivosDrive");
const proyectosRepositorio = require("../../src/repositorios/proyectosRepositorio");
const requisicionesRepositorio = require("../../src/repositorios/requisicionesRepositorio");
const proyectoDriveCarpetasRepositorio = require("../../src/repositorios/proyectoDriveCarpetasRepositorio");
const { obtenerCarpetaParaArchivo } = require("../../src/servicios/proyectoCarpetasDrive");

const pool = {};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.DRIVE_FOLDER_ID = "raiz-erp";
});

describe("obtenerCarpetaParaArchivo", () => {
  test("proyecto sin carpeta: crea carpeta de proyecto y de fase, y guarda ambos ids", async () => {
    const proyecto = { id: 1, codigo_pry: "PRY-2026-001", estado: "planeacion", drive_folder_id: null };
    archivosDrive.crearCarpeta
      .mockResolvedValueOnce({ id: "carpeta-proyecto" })
      .mockResolvedValueOnce({ id: "carpeta-fase" });
    proyectoDriveCarpetasRepositorio.obtenerPorProyectoYFase.mockResolvedValue(null);

    const carpetaId = await obtenerCarpetaParaArchivo(pool, { tabla: "proyectos", registro: proyecto });

    expect(archivosDrive.crearCarpeta).toHaveBeenNthCalledWith(1, {
      nombre: "PRY-2026-001",
      parentId: "raiz-erp",
    });
    expect(archivosDrive.crearCarpeta).toHaveBeenNthCalledWith(2, {
      nombre: "planeacion",
      parentId: "carpeta-proyecto",
    });
    expect(proyectosRepositorio.actualizar).toHaveBeenCalledWith(pool, 1, {
      drive_folder_id: "carpeta-proyecto",
    });
    expect(proyectoDriveCarpetasRepositorio.crear).toHaveBeenCalledWith(pool, {
      proyectoId: 1,
      fase: "planeacion",
      driveFolderId: "carpeta-fase",
    });
    expect(carpetaId).toBe("carpeta-fase");
  });

  test("proyecto con carpeta y fase ya existentes: no crea nada en Drive", async () => {
    const proyecto = { id: 2, codigo_pry: "PRY-2026-002", estado: "ejecucion", drive_folder_id: "ya-existe" };
    proyectoDriveCarpetasRepositorio.obtenerPorProyectoYFase.mockResolvedValue({
      drive_folder_id: "fase-ya-existe",
    });

    const carpetaId = await obtenerCarpetaParaArchivo(pool, { tabla: "proyectos", registro: proyecto });

    expect(archivosDrive.crearCarpeta).not.toHaveBeenCalled();
    expect(carpetaId).toBe("fase-ya-existe");
  });

  test("proyecto_actividades: usa la fase propia de la actividad, no la del proyecto", async () => {
    const actividad = { proyecto_id: 3, fase: "prospecto" };
    proyectosRepositorio.obtenerPorId.mockResolvedValue({
      id: 3,
      codigo_pry: "PRY-2026-003",
      estado: "ejecucion",
      drive_folder_id: "carpeta-proyecto-3",
    });
    proyectoDriveCarpetasRepositorio.obtenerPorProyectoYFase.mockResolvedValue({
      drive_folder_id: "carpeta-fase-prospecto",
    });

    const carpetaId = await obtenerCarpetaParaArchivo(pool, {
      tabla: "proyecto_actividades",
      registro: actividad,
    });

    expect(proyectoDriveCarpetasRepositorio.obtenerPorProyectoYFase).toHaveBeenCalledWith(
      pool,
      3,
      "prospecto"
    );
    expect(carpetaId).toBe("carpeta-fase-prospecto");
  });

  test("requisiciones: usa la fase vigente del proyecto", async () => {
    const requisicion = { proyecto_id: 4 };
    proyectosRepositorio.obtenerPorId.mockResolvedValue({
      id: 4,
      codigo_pry: "PRY-2026-004",
      estado: "cierre",
      drive_folder_id: "carpeta-proyecto-4",
    });
    proyectoDriveCarpetasRepositorio.obtenerPorProyectoYFase.mockResolvedValue({
      drive_folder_id: "carpeta-fase-cierre",
    });

    const carpetaId = await obtenerCarpetaParaArchivo(pool, {
      tabla: "requisiciones",
      registro: requisicion,
    });

    expect(proyectoDriveCarpetasRepositorio.obtenerPorProyectoYFase).toHaveBeenCalledWith(
      pool,
      4,
      "cierre"
    );
    expect(carpetaId).toBe("carpeta-fase-cierre");
  });

  test("ordenes_compra: resuelve proyecto a través de la requisición", async () => {
    const orden = { requisicion_id: 10 };
    requisicionesRepositorio.obtenerPorId.mockResolvedValue({ proyecto_id: 5 });
    proyectosRepositorio.obtenerPorId.mockResolvedValue({
      id: 5,
      codigo_pry: "PRY-2026-005",
      estado: "ejecucion",
      drive_folder_id: "carpeta-proyecto-5",
    });
    proyectoDriveCarpetasRepositorio.obtenerPorProyectoYFase.mockResolvedValue({
      drive_folder_id: "carpeta-fase-ejecucion",
    });

    const carpetaId = await obtenerCarpetaParaArchivo(pool, {
      tabla: "ordenes_compra",
      registro: orden,
    });

    expect(requisicionesRepositorio.obtenerPorId).toHaveBeenCalledWith(pool, 10);
    expect(proyectosRepositorio.obtenerPorId).toHaveBeenCalledWith(pool, 5);
    expect(carpetaId).toBe("carpeta-fase-ejecucion");
  });
});
