const zlib = require("zlib");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

// Drive simulado: guarda lo que se "sube" para revisarlo.
const subidos = [];
jest.mock("../../src/servicios/archivosDrive", () => ({
  subirArchivo: jest.fn(async (archivo) => {
    subidos.push(archivo);
    return { driveFileId: `drive-${subidos.length}`, driveEnlace: "https://drive.test/archivo" };
  }),
}));
const archivosDrive = require("../../src/servicios/archivosDrive");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Copias de seguridad (integración)", () => {
  let app;
  let pool;
  const u = {};
  const tokens = {};
  const sufijo = sufijoUnico();
  const razonSocial = `Cliente O'Copia "${sufijo}" — ñ`;
  let clienteId;
  const variablesOriginales = {};
  const VARIABLES = {
    GMAIL_CLIENT_ID: "id-de-prueba",
    GMAIL_CLIENT_SECRET: "secreto-de-prueba",
    GMAIL_REFRESH_TOKEN: "token-de-prueba",
    DRIVE_FOLDER_ID: "carpeta-de-prueba",
  };

  const como = (quien) => ({ Authorization: `Bearer ${tokens[quien]}` });

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    Object.entries(VARIABLES).forEach(([clave, valor]) => {
      variablesOriginales[clave] = process.env[clave];
      process.env[clave] = valor;
    });
    pool = crearPool();
    for (const [clave, rol, cargo] of [
      ["admin", "admin", null],
      ["director", "tester", "Director de Operaciones y Producción"],
    ]) {
      const correo = `copias-${clave}-${sufijo}@speal.test`;
      const [r] = await pool.query(
        "INSERT INTO usuarios (nombre, correo, password_hash, rol, cargo, activo) VALUES (?, ?, 'x', ?, ?, 1)",
        [`Copias ${clave}`, correo, rol, cargo]
      );
      u[clave] = r.insertId;
      tokens[clave] = jwt.sign({ id: r.insertId, correo, rol }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
    }
    const [cliente] = await pool.query(
      `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
       VALUES (?, 'NIT', ?, ?)`,
      [razonSocial, `CS-${sufijo}`, u.admin]
    );
    clienteId = cliente.insertId;
    app = crearApp();
  });

  afterAll(async () => {
    await pool.query(
      "DELETE FROM auditoria WHERE tabla = 'copias_seguridad' AND usuario_id IN (?)",
      [Object.values(u)]
    );
    await pool.query("DELETE FROM copias_seguridad WHERE solicitada_por IN (?)", [
      Object.values(u),
    ]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM usuarios WHERE id IN (?)", [Object.values(u)]);
    await pool.end();
    Object.entries(variablesOriginales).forEach(([clave, valor]) => {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    });
  });

  test("solo admin y Gerente General ven y hacen copias", async () => {
    expect((await request(app).get("/copias").set(como("director"))).status).toBe(403);
    expect((await request(app).post("/copias").set(como("director"))).status).toBe(403);
    const r = await request(app).get("/copias").set(como("admin"));
    expect(r.status).toBe(200);
    expect(r.body.configuracion).toMatchObject({ drive_configurado: true, hora: 2 });
  });

  test("la copia manual sube la base completa comprimida y queda registrada", async () => {
    const r = await request(app).post("/copias").set(como("admin"));
    expect(r.status).toBe(201);
    const { copia } = r.body;
    expect(copia).toMatchObject({
      resultado: "exitosa",
      origen: "manual",
      solicitada_por: u.admin,
      solicitada_por_nombre: "Copias admin",
      drive_archivo_id: `drive-${subidos.length}`,
      error: null,
    });
    expect(copia.tablas).toBeGreaterThan(30);
    expect(copia.archivo_nombre).toMatch(/^copia-erp-.+-\d{4}-\d{2}-\d{2}_\d{4}\.sql\.gz$/);

    const subido = subidos[subidos.length - 1];
    expect(subido.mimeType).toBe("application/gzip");
    expect(subido.parentId).toBe("carpeta-de-prueba");
    expect(copia.tamano_bytes).toBe(subido.buffer.length);
    const sql = zlib.gunzipSync(subido.buffer).toString("utf8");
    expect(sql).toContain("CREATE TABLE `usuarios`");
    expect(sql).toContain("CREATE TABLE `copias_seguridad`");

    const [auditoria] = await pool.query(
      "SELECT accion FROM auditoria WHERE tabla = 'copias_seguridad' AND registro_id = ?",
      [copia.id]
    );
    expect(auditoria.map((a) => a.accion)).toEqual(["crear"]);
  });

  test("la copia se restaura en una base vacía con los mismos datos", async () => {
    const sql = zlib.gunzipSync(subidos[subidos.length - 1].buffer).toString("utf8");
    const base = `erp_restaurada_${sufijo}`;
    const conexion = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      charset: "utf8mb4",
      multipleStatements: true,
    });
    try {
      await conexion.query(`CREATE DATABASE \`${base}\` CHARACTER SET utf8mb4`);
      await conexion.query(`USE \`${base}\``);
      await conexion.query(sql);
      const [[cliente]] = await conexion.query(
        "SELECT nombre_razon_social, created_at FROM clientes WHERE id = ?",
        [clienteId]
      );
      expect(cliente.nombre_razon_social).toBe(razonSocial);
      const [[original]] = await pool.query("SELECT created_at FROM clientes WHERE id = ?", [
        clienteId,
      ]);
      expect(new Date(cliente.created_at).getTime()).toBe(new Date(original.created_at).getTime());
      const [[{ n }]] = await conexion.query("SELECT COUNT(*) AS n FROM usuarios WHERE id IN (?)", [
        Object.values(u),
      ]);
      expect(n).toBe(2);
    } finally {
      await conexion.query(`DROP DATABASE IF EXISTS \`${base}\``);
      await conexion.end();
    }
  });

  test("si Drive falla, la copia queda como fallida con el motivo", async () => {
    archivosDrive.subirArchivo.mockRejectedValueOnce(new Error("insufficient permissions"));
    const r = await request(app).post("/copias").set(como("admin"));
    expect(r.status).toBe(201);
    expect(r.body.copia).toMatchObject({
      resultado: "fallida",
      error: "insufficient permissions",
      drive_archivo_id: null,
    });
    const lista = await request(app).get("/copias").set(como("admin"));
    expect(lista.body.copias[0].id).toBe(r.body.copia.id);
  });

  test("sin token de Drive la copia falla con un mensaje claro", async () => {
    delete process.env.GMAIL_REFRESH_TOKEN;
    try {
      const r = await request(app).post("/copias").set(como("admin"));
      expect(r.body.copia.resultado).toBe("fallida");
      expect(r.body.copia.error).toContain("Google Drive no está configurado");
    } finally {
      process.env.GMAIL_REFRESH_TOKEN = VARIABLES.GMAIL_REFRESH_TOKEN;
    }
  });
});
