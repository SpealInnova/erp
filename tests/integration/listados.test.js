const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

// Listas paginadas: total, páginas sin repetir filas, búsqueda por texto
// (también en nombres de tablas relacionadas) y filtro por estado.
describirSiHayBD("Listas con búsqueda y paginación (integración)", () => {
  let app;
  let pool;
  let token;
  const sufijo = sufijoUnico();
  const marca = `LST${sufijo}`;
  const ids = { clientes: [], proyectos: [] };

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();
    const q = (sql, p) => pool.query(sql, p).then(([r]) => r);
    const passwordHash = await bcrypt.hash("ClaveSegura123", 10);
    ids.usuario = (
      await q(
        "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
        [`Listas ${marca}`, `listas-${sufijo}@speal.test`, passwordHash]
      )
    ).insertId;
    token = jwt.sign(
      { id: ids.usuario, correo: `listas-${sufijo}@speal.test`, rol: "tester" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 25 clientes con la marca; el último se llama distinto para buscarlo.
    for (let i = 1; i <= 25; i += 1) {
      const nombre =
        i === 25 ? `Hospital Ñandú ${marca}` : `Cliente ${marca} ${String(i).padStart(2, "0")}`;
      ids.clientes.push(
        (
          await q(
            `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
             VALUES (?, 'NIT', ?, ?)`,
            [nombre, `${marca}-${i}`, ids.usuario]
          )
        ).insertId
      );
    }
    // 3 proyectos del cliente "Hospital": 2 en diseño y 1 en compras
    for (const [n, estado] of [
      [1, "diseno"],
      [2, "diseno"],
      [3, "compras"],
    ]) {
      ids.proyectos.push(
        (
          await q(
            `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
             VALUES (?, ?, ?, ?, ?)`,
            [`PRY-LS-${sufijo}-${n}`, ids.clientes[24], `Planta ${marca} ${n}`, estado, ids.usuario]
          )
        ).insertId
      );
    }
    ids.proveedor = (
      await q(
        `INSERT INTO proveedores (nit_cc, razon_social, tipo_persona, origen, clasificacion, created_by)
         VALUES (?, ?, 'juridica', 'nacional', 'productos', ?)`,
        [`PROV-${marca}`, `Válvulas ${marca} SAS`, ids.usuario]
      )
    ).insertId;
    ids.requisicion = (
      await q(
        `INSERT INTO requisiciones (numero_requisicion, proyecto_id, solicitante_id, procedencia, estado)
         VALUES (?, ?, ?, 'nacional', 'convertida_oc')`,
        [`REQ-${marca}`, ids.proyectos[0], ids.usuario]
      )
    ).insertId;
    for (const [n, estado] of [
      [1, "pte_aprobar"],
      [2, "paga"],
    ]) {
      await q(
        `INSERT INTO ordenes_compra (numero_oc, requisicion_id, proveedor_id, estado, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [`OC-${marca}-${n}`, ids.requisicion, ids.proveedor, estado, ids.usuario]
      );
    }
    app = crearApp();
  });

  afterAll(async () => {
    const q = (sql, p) => pool.query(sql, p);
    await q("DELETE FROM ordenes_compra WHERE requisicion_id = ?", [ids.requisicion]);
    await q("DELETE FROM requisiciones WHERE id = ?", [ids.requisicion]);
    await q("DELETE FROM proveedores WHERE id = ?", [ids.proveedor]);
    await q("DELETE FROM proyectos WHERE id IN (?)", [ids.proyectos]);
    await q("DELETE FROM clientes WHERE id IN (?)", [ids.clientes]);
    await q("DELETE FROM usuarios WHERE id = ?", [ids.usuario]);
    await pool.end();
  });

  const get = (ruta) =>
    request(app)
      .get(ruta)
      .set({ Authorization: `Bearer ${token}` });

  test("pagina con total y sin repetir filas entre páginas", async () => {
    const p1 = await get(`/clientes?q=${marca}&tamanoPagina=10&pagina=1`);
    const p3 = await get(`/clientes?q=${marca}&tamanoPagina=10&pagina=3`);
    expect(p1.status).toBe(200);
    expect(p1.body).toMatchObject({ total: 25, pagina: 1, tamanoPagina: 10 });
    expect(p1.body.clientes).toHaveLength(10);
    expect(p3.body.clientes).toHaveLength(5);

    const p2 = await get(`/clientes?q=${marca}&tamanoPagina=10&pagina=2`);
    const vistos = [...p1.body.clientes, ...p2.body.clientes, ...p3.body.clientes].map((c) => c.id);
    expect(new Set(vistos).size).toBe(25);
    // más recientes primero
    expect(p1.body.clientes[0].id).toBe(ids.clientes[24]);
  });

  test("busca sin importar mayúsculas ni tildes, y trata % como texto", async () => {
    const r = await get(`/clientes?q=${encodeURIComponent(`hospital ñandu ${marca}`)}`);
    expect(r.body.total).toBe(1);
    expect(r.body.clientes[0].id).toBe(ids.clientes[24]);

    const comodin = await get(`/clientes?q=${encodeURIComponent(`${marca}%`)}`);
    expect(comodin.body.total).toBe(0);
  });

  test("busca proyectos por el nombre de su cliente y filtra por estado", async () => {
    const r = await get(`/proyectos?q=${encodeURIComponent(`Ñandú ${marca}`)}`);
    expect(r.body.total).toBe(3);
    expect(r.body.proyectos[0]).toMatchObject({
      cliente_nombre: `Hospital Ñandú ${marca}`,
      responsable_nombre: `Listas ${marca}`,
    });

    const enDiseno = await get(`/proyectos?q=${marca}&estado=diseno`);
    expect(enDiseno.body.total).toBe(2);
    expect(enDiseno.body.proyectos.every((p) => p.estado === "diseno")).toBe(true);
  });

  test("órdenes de compra: busca por proveedor y trae proveedor y proyecto", async () => {
    const r = await get(`/ordenes-compra?q=${encodeURIComponent(`Válvulas ${marca}`)}&estado=paga`);
    expect(r.body.total).toBe(1);
    expect(r.body.ordenes[0]).toMatchObject({
      numero_oc: `OC-${marca}-2`,
      proveedor_nombre: `Válvulas ${marca} SAS`,
      proyecto_codigo: `PRY-LS-${sufijo}-1`,
    });
  });

  test("valida tamaño de página y estado; un texto vacío no filtra", async () => {
    expect((await get("/clientes?tamanoPagina=101")).status).toBe(400);
    expect((await get("/proyectos?estado=inventado")).status).toBe(400);
    const vacio = await get("/proyectos?q=&estado=");
    expect(vacio.status).toBe(200);
  });

  test("las demás listas responden la página con su total", async () => {
    for (const [ruta, campo] of [
      ["/cotizaciones", "cotizaciones"],
      ["/proveedores", "proveedores"],
      ["/requisiciones", "requisiciones"],
      ["/expedientes-diseno", "expedientes"],
      ["/reportes-servicio-tecnico", "reportes"],
      ["/actas-cierre-satisfaccion", "actas"],
      ["/actas-entrega-equipos", "actas"],
      ["/equipos", "equipos"],
    ]) {
      const r = await get(`${ruta}?q=${marca}&tamanoPagina=5`);
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body[campo])).toBe(true);
      expect(typeof r.body.total).toBe("number");
      expect(r.body.tamanoPagina).toBe(5);
    }
    const req = await get(`/requisiciones?q=${marca}`);
    expect(req.body.requisiciones[0]).toMatchObject({ proyecto_codigo: `PRY-LS-${sufijo}-1` });
  });
});
