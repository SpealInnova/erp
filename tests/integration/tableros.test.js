const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { obtenerTableroGerencial } = require("../../src/servicios/tableros");
const tablerosRepositorio = require("../../src/repositorios/tablerosRepositorio");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

// La BD de pruebas es compartida con otras suites: las aserciones buscan los
// registros propios por id/código en vez de asumir que son los únicos.
describirSiHayBD("Tablero gerencial (integración contra BD real)", () => {
  let app;
  let pool;
  let token;
  const sufijo = sufijoUnico();
  const ids = {};
  const codigoPry = `PRY-TB-${sufijo}`;
  const codigoExp = `EXP-TB-${sufijo}`;
  const numeroOC = `OC-TB-${sufijo}`;
  const hoy = new Date(2026, 1, 1); // 1 feb 2026

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();

    const passwordHash = await bcrypt.hash("ClaveSegura123", 10);
    const [usuario] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
      [`Tablero ${sufijo}`, `tablero-${sufijo}@speal.test`, passwordHash]
    );
    ids.usuario = usuario.insertId;
    token = jwt.sign(
      { id: ids.usuario, correo: `tablero-${sufijo}@speal.test`, rol: "tester" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const [cliente] = await pool.query(
      `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
       VALUES (?, 'NIT', ?, ?)`,
      [`Cliente Tablero ${sufijo}`, `TB-${sufijo}`, ids.usuario]
    );
    ids.cliente = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id, presupuesto_estimado)
       VALUES (?, ?, 'Proyecto del tablero', 'compras', ?, 1000000)`,
      [codigoPry, ids.cliente, ids.usuario]
    );
    ids.proyecto = proyecto.insertId;

    const actividades = [
      ["completada", "2026-01-05", "2026-01-08"],
      ["pendiente", "2026-01-09", "2026-01-12"],
      ["pendiente", "2026-01-12", "2026-01-20"],
      ["pendiente", null, null],
    ];
    for (const [estado, inicio, fin] of actividades) {
      await pool.query(
        `INSERT INTO proyecto_actividades
          (proyecto_id, fase, categoria, descripcion, responsable_id, estado, fecha_inicio, fecha_fin)
         VALUES (?, 'compras', 'Compras', 'Actividad de prueba', ?, ?, ?, ?)`,
        [ids.proyecto, ids.usuario, estado, inicio, fin]
      );
    }

    const [cotAceptada] = await pool.query(
      `INSERT INTO cotizaciones (numero_cotizacion, cliente_id, asesor_comercial_id, estado, created_at)
       VALUES (?, ?, ?, 'aceptada', '2026-01-15 10:00:00')`,
      [`COT-TA-${sufijo}`, ids.cliente, ids.usuario]
    );
    ids.cotAceptada = cotAceptada.insertId;
    await pool.query(
      `INSERT INTO cotizacion_items (cotizacion_id, descripcion, cantidad, valor_unitario, descuento_porcentaje, iva_porcentaje)
       VALUES (?, 'Equipo', 2, 100, 0, 19)`,
      [ids.cotAceptada]
    );

    const [cotAprobacion] = await pool.query(
      `INSERT INTO cotizaciones (numero_cotizacion, cliente_id, asesor_comercial_id, estado, created_at, updated_at)
       VALUES (?, ?, ?, 'aprobacion', '2026-01-20 10:00:00', '2026-01-29 10:00:00')`,
      [`COT-TB-${sufijo}`, ids.cliente, ids.usuario]
    );
    ids.cotAprobacion = cotAprobacion.insertId;
    await pool.query(
      `INSERT INTO cotizacion_items (cotizacion_id, descripcion, cantidad, valor_unitario, descuento_porcentaje, iva_porcentaje)
       VALUES (?, 'Servicio', 1, 1000, 0, 0)`,
      [ids.cotAprobacion]
    );

    const [proveedor] = await pool.query(
      `INSERT INTO proveedores (nit_cc, razon_social, tipo_persona, origen, clasificacion, created_by)
       VALUES (?, ?, 'juridica', 'nacional', 'productos', ?)`,
      [`PROV-TB-${sufijo}`, `Proveedor Tablero ${sufijo}`, ids.usuario]
    );
    ids.proveedor = proveedor.insertId;

    const [requisicion] = await pool.query(
      `INSERT INTO requisiciones (numero_requisicion, proyecto_id, solicitante_id, procedencia, estado)
       VALUES (?, ?, ?, 'nacional', 'convertida_oc')`,
      [`REQ-TB-${sufijo}`, ids.proyecto, ids.usuario]
    );
    ids.requisicion = requisicion.insertId;

    const [orden] = await pool.query(
      `INSERT INTO ordenes_compra (numero_oc, requisicion_id, proveedor_id, estado, created_by, created_at)
       VALUES (?, ?, ?, 'pte_aprobar', ?, '2026-01-25 09:00:00')`,
      [numeroOC, ids.requisicion, ids.proveedor, ids.usuario]
    );
    ids.orden = orden.insertId;
    await pool.query(
      `INSERT INTO orden_compra_items (orden_compra_id, descripcion, cantidad, precio_unitario)
       VALUES (?, 'Ítem A', 2, 1500), (?, 'Ítem B', 1, 500)`,
      [ids.orden, ids.orden]
    );

    const [expediente] = await pool.query(
      `INSERT INTO expedientes_diseno (codigo_expediente, proyecto_id, producto_nombre, responsable_diseno_id)
       VALUES (?, ?, 'Planta de prueba', ?)`,
      [codigoExp, ids.proyecto, ids.usuario]
    );
    ids.expediente = expediente.insertId;
    const [cambio] = await pool.query(
      `INSERT INTO cambios_diseno (expediente_id, numero, descripcion, estado, created_by, created_at)
       VALUES (?, 1, 'Reubicar tanque pulmón', 'pendiente', ?, '2026-01-28 08:00:00')`,
      [ids.expediente, ids.usuario]
    );
    ids.cambio = cambio.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM cambios_diseno WHERE id = ?", [ids.cambio]);
    await pool.query("DELETE FROM expedientes_diseno WHERE id = ?", [ids.expediente]);
    await pool.query("DELETE FROM orden_compra_items WHERE orden_compra_id = ?", [ids.orden]);
    await pool.query("DELETE FROM ordenes_compra WHERE id = ?", [ids.orden]);
    await pool.query("DELETE FROM requisiciones WHERE id = ?", [ids.requisicion]);
    await pool.query("DELETE FROM proveedores WHERE id = ?", [ids.proveedor]);
    await pool.query("DELETE FROM cotizacion_items WHERE cotizacion_id IN (?, ?)", [
      ids.cotAceptada,
      ids.cotAprobacion,
    ]);
    await pool.query("DELETE FROM cotizaciones WHERE id IN (?, ?)", [
      ids.cotAceptada,
      ids.cotAprobacion,
    ]);
    await pool.query("DELETE FROM proyecto_actividades WHERE proyecto_id = ?", [ids.proyecto]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [ids.proyecto]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [ids.cliente]);
    await pool.query("DELETE FROM usuarios WHERE id = ?", [ids.usuario]);
    await pool.end();
  });

  test("exige sesión", async () => {
    const respuesta = await request(app).get("/tableros/gerencial");
    expect(respuesta.status).toBe(401);
  });

  test("responde con todas las secciones del tablero", async () => {
    const respuesta = await request(app)
      .get("/tableros/gerencial")
      .set({ Authorization: `Bearer ${token}` });
    expect(respuesta.status).toBe(200);
    const { tablero } = respuesta.body;
    expect(tablero.hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tablero.kpis).toEqual(
      expect.objectContaining({
        proyectos_activos: expect.any(Number),
        cotizaciones_abiertas: expect.any(Object),
        oc_por_aprobar: expect.any(Object),
        proyectos_vencidos: expect.any(Object),
      })
    );
    expect(tablero.proyectos_por_fase).toHaveLength(9);
    expect(tablero.cotizaciones_por_mes).toHaveLength(6);
    expect(Array.isArray(tablero.cartera)).toBe(true);
    expect(Array.isArray(tablero.aprobaciones)).toBe(true);
  });

  test("arma la cartera con fechas del plan, avance, comprometido y vencimiento", async () => {
    const tablero = await obtenerTableroGerencial(pool, { hoy });
    const fila = tablero.cartera.find((p) => p.id === ids.proyecto);
    expect(fila).toEqual(
      expect.objectContaining({
        codigo_pry: codigoPry,
        estado: "compras",
        fecha_inicio: "2026-01-05",
        fecha_fin: "2026-01-20",
        actividades_total: 4,
        actividades_completadas: 1,
        progreso: 25,
        comprometido: 3500,
        presupuesto_estimado: 1000000,
        vencido: true,
      })
    );
    expect(tablero.kpis.proyectos_vencidos.codigos).toContain(codigoPry);
    const fase = tablero.proyectos_por_fase.find((f) => f.estado === "compras");
    expect(fase.cantidad).toBeGreaterThanOrEqual(1);
  });

  test("lista lo que espera aprobación con su antigüedad", async () => {
    const tablero = await obtenerTableroGerencial(pool, { hoy });
    const oc = tablero.aprobaciones.find((a) => a.tipo === "orden_compra" && a.id === ids.orden);
    expect(oc).toEqual(
      expect.objectContaining({
        codigo: numeroOC,
        titulo: "Ítem A y 1 ítem(s) más",
        valor: 3500,
        dias: 7,
      })
    );
    const cambio = tablero.aprobaciones.find(
      (a) => a.tipo === "cambio_diseno" && a.id === ids.cambio
    );
    expect(cambio).toEqual(
      expect.objectContaining({
        expediente_id: ids.expediente,
        codigo: `${codigoExp} · C-01`,
        titulo: "Reubicar tanque pulmón",
        dias: 4,
      })
    );
    const cotizacion = tablero.aprobaciones.find(
      (a) => a.tipo === "cotizacion" && a.id === ids.cotAprobacion
    );
    expect(cotizacion).toEqual(expect.objectContaining({ valor: 1000, dias: 3 }));
  });

  test("suma lo cotizado y lo aceptado por mes de creación", async () => {
    const tablero = await obtenerTableroGerencial(pool, { hoy });
    expect(tablero.cotizaciones_por_mes.map((m) => m.mes)).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    const enero = tablero.cotizaciones_por_mes.find((m) => m.mes === "2026-01");
    expect(enero.cotizado).toBeGreaterThanOrEqual(1238);
    expect(enero.aceptado).toBeGreaterThanOrEqual(238);
  });

  test("cuenta las actividades abiertas por responsable", async () => {
    const carga = await tablerosRepositorio.contarActividadesAbiertasPorResponsable(pool, [
      "cerrado",
      "cancelado",
    ]);
    const propia = carga.find((c) => c.usuario_id === ids.usuario);
    expect(propia.abiertas).toBe(3);
  });
});
