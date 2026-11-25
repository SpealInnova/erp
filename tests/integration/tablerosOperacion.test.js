const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const {
  obtenerTableroDiseno,
  obtenerTableroSoporte,
  obtenerTableroEntregas,
} = require("../../src/servicios/tablerosOperacion");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

// La BD de pruebas es compartida: se buscan los registros propios por id o
// código, sin asumir que son los únicos.
describirSiHayBD("Resúmenes de Diseño, Soporte y Entregas (integración)", () => {
  let app;
  let pool;
  let token;
  const sufijo = sufijoUnico();
  const ids = {};
  const hoy = new Date(2026, 1, 1); // 1 feb 2026
  const serieA = `EQ-TOA-${sufijo}`;
  const serieB = `EQ-TOB-${sufijo}`;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();
    const q = async (sql, params) => (await pool.query(sql, params))[0];

    const usuario = await q(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, cargo, activo) VALUES (?, ?, 'x', 'tester', 'Técnico', 1)",
      [`Operación ${sufijo}`, `operacion-${sufijo}@speal.test`]
    );
    ids.usuario = usuario.insertId;
    token = jwt.sign(
      { id: ids.usuario, correo: `operacion-${sufijo}@speal.test`, rol: "tester" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    ids.cliente = (
      await q(
        `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
         VALUES (?, 'NIT', ?, ?)`,
        [`Cliente Operación ${sufijo}`, `TO-${sufijo}`, ids.usuario]
      )
    ).insertId;
    const proyecto = async (codigo, estado) =>
      (
        await q(
          `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
           VALUES (?, ?, ?, ?, ?)`,
          [codigo, ids.cliente, `Proyecto ${codigo}`, estado, ids.usuario]
        )
      ).insertId;
    ids.pSeguimiento = await proyecto(`PRY-TOS-${sufijo}`, "seguimiento");
    ids.pInstalacion = await proyecto(`PRY-TOI-${sufijo}`, "instalacion");

    /* ---- Diseño ---- */
    ids.expPendiente = (
      await q(
        `INSERT INTO expedientes_diseno (codigo_expediente, proyecto_id, producto_nombre, responsable_diseno_id, created_at)
         VALUES (?, ?, 'Generador de prueba', ?, '2026-01-10 08:00:00')`,
        [`EXP-TOP-${sufijo}`, ids.pSeguimiento, ids.usuario]
      )
    ).insertId;
    await q(
      `INSERT INTO requisitos_entrada (expediente_id, requisito, cumple) VALUES (?, 'Pureza mínima 93 %', 'si')`,
      [ids.expPendiente]
    );
    await q(
      `INSERT INTO verificaciones (expediente_id, requisito_verificado, resultado)
       VALUES (?, 'Pureza mínima 93 %', 'conforme')`,
      [ids.expPendiente]
    );
    await q(
      `INSERT INTO salidas_diseno (expediente_id, salida, responsable_id, estado)
       VALUES (?, 'Plano general', ?, 'aprobada')`,
      [ids.expPendiente, ids.usuario]
    );
    ids.expDecidido = (
      await q(
        `INSERT INTO expedientes_diseno (codigo_expediente, proyecto_id, producto_nombre, responsable_diseno_id, estado_liberacion)
         VALUES (?, ?, 'Equipo liberado', ?, 'aprobado_con_restricciones')`,
        [`EXP-TOD-${sufijo}`, ids.pSeguimiento, ids.usuario]
      )
    ).insertId;
    await q(
      `INSERT INTO auditoria (tabla, registro_id, accion, usuario_id, datos_anteriores, datos_nuevos, creado_en)
       VALUES ('expedientes_diseno', ?, 'actualizar', ?,
               JSON_OBJECT('estado_liberacion', 'pendiente'),
               JSON_OBJECT('estado_liberacion', 'aprobado_con_restricciones'), '2026-01-20 10:00:00')`,
      [ids.expDecidido, ids.usuario]
    );

    /* ---- Soporte ---- */
    const equipo = async (serie, instalacion) =>
      (
        await q(
          `INSERT INTO equipos (numero_serie, cliente_id, proyecto_id, descripcion, fecha_instalacion, origen)
           VALUES (?, ?, ?, 'Concentrador de prueba', ?, 'historico')`,
          [serie, ids.cliente, ids.pSeguimiento, instalacion]
        )
      ).insertId;
    ids.equipoA = await equipo(serieA, "2025-06-01");
    ids.equipoB = await equipo(serieB, "2015-01-01"); // nunca atendido
    ids.reportes = [];
    for (const [n, fecha] of [
      [1, "2026-01-10"],
      [2, "2026-01-20"],
    ]) {
      const r = await q(
        `INSERT INTO reportes_servicio_tecnico
          (numero_reporte, equipo_numero_serie, cliente_id, proyecto_id, tipo_servicio,
           tecnico_responsable_id, fecha_servicio, hora_inicio, hora_fin)
         VALUES (?, ?, ?, ?, 'mantenimiento_correctivo', ?, ?, '08:00:00', '10:00:00')`,
        [`RST-TO${n}-${sufijo}`, serieA, ids.cliente, ids.pSeguimiento, ids.usuario, fecha]
      );
      ids.reportes.push(r.insertId);
    }

    /* ---- Entregas ---- */
    const actaEntrega = async (numero, fecha) =>
      (
        await q(
          `INSERT INTO actas_entrega_equipos
            (numero_acta, proyecto_id, cliente_id, objeto, entregante_id, receptor_nombre, fecha_elaboracion)
           VALUES (?, ?, ?, 'Entrega de prueba', ?, 'Receptor', ?)`,
          [numero, ids.pSeguimiento, ids.cliente, ids.usuario, fecha]
        )
      ).insertId;
    ids.entregaAbierta = await actaEntrega(`AE-TOA-${sufijo}`, "2026-01-05");
    ids.entregaCerrada = await actaEntrega(`AE-TOC-${sufijo}`, "2025-12-01");
    await q(
      `INSERT INTO acta_entrega_items (acta_id, descripcion_equipo, cantidad, numero_serie, cumple)
       VALUES (?, 'Manómetro de salida', 1, 'MN-1', 'no')`,
      [ids.entregaAbierta]
    );
    ids.cierre = (
      await q(
        `INSERT INTO actas_cierre_satisfaccion
          (numero_acta, proyecto_id, cliente_id, acta_entrega_id, tipo_entrega, tipo_documento_referencia,
           objeto, responsable_entrega_id, receptor_cliente_nombre, fecha_elaboracion)
         VALUES (?, ?, ?, ?, 'venta', 'orden_compra', 'Cierre de prueba', ?, 'Receptor', '2025-12-11')`,
        [`ACS-TO-${sufijo}`, ids.pSeguimiento, ids.cliente, ids.entregaCerrada, ids.usuario]
      )
    ).insertId;

    app = crearApp();
  });

  afterAll(async () => {
    const q = (sql, params) => pool.query(sql, params);
    await q("DELETE FROM actas_cierre_satisfaccion WHERE id = ?", [ids.cierre]);
    await q("DELETE FROM acta_entrega_items WHERE acta_id IN (?)", [
      [ids.entregaAbierta, ids.entregaCerrada],
    ]);
    await q("DELETE FROM actas_entrega_equipos WHERE id IN (?)", [
      [ids.entregaAbierta, ids.entregaCerrada],
    ]);
    await q("DELETE FROM reportes_servicio_tecnico WHERE id IN (?)", [ids.reportes]);
    await q("DELETE FROM equipos WHERE id IN (?)", [[ids.equipoA, ids.equipoB]]);
    await q("DELETE FROM requisitos_entrada WHERE expediente_id = ?", [ids.expPendiente]);
    await q("DELETE FROM verificaciones WHERE expediente_id = ?", [ids.expPendiente]);
    await q("DELETE FROM salidas_diseno WHERE expediente_id = ?", [ids.expPendiente]);
    await q("DELETE FROM auditoria WHERE usuario_id = ?", [ids.usuario]);
    await q("DELETE FROM expedientes_diseno WHERE id IN (?)", [
      [ids.expPendiente, ids.expDecidido],
    ]);
    await q("DELETE FROM proyectos WHERE id IN (?)", [[ids.pSeguimiento, ids.pInstalacion]]);
    await q("DELETE FROM clientes WHERE id = ?", [ids.cliente]);
    await q("DELETE FROM usuarios WHERE id = ?", [ids.usuario]);
    await pool.end();
  });

  test("Diseño: qué le falta a cada expediente y las decisiones por mes", async () => {
    const t = await obtenerTableroDiseno(pool, { hoy });
    const fila = t.pendientes.find((e) => e.id === ids.expPendiente);
    expect(fila).toMatchObject({ dias: 22, pasos_listos: 4, pasos_total: 9 });
    expect(fila.faltan).toEqual(
      expect.arrayContaining([
        "Revisión de diseño",
        "Evaluar riesgos",
        "Validación conforme",
        "Transferencia a producción",
        "Número de serie",
      ])
    );
    expect(fila.faltan).not.toContain("Requisitos de entrada");
    expect(t.pendientes.some((e) => e.id === ids.expDecidido)).toBe(false);
    const enero = t.liberaciones_por_mes.find((m) => m.mes === "2026-01");
    expect(enero.con_restricciones).toBeGreaterThanOrEqual(1);
    expect(t.kpis.liberados_6m.con_restricciones).toBeGreaterThanOrEqual(1);
  });

  test("Soporte: fallas repetidas, equipos para visitar y duración", async () => {
    const t = await obtenerTableroSoporte(pool, { hoy });
    expect(t.fallas_repetidas).toEqual(
      expect.arrayContaining([expect.objectContaining({ numero_serie: serieA, cantidad: 2 })])
    );
    const visitar = t.equipos_para_visitar.find((x) => x.numero_serie === serieB);
    expect(visitar).toMatchObject({ ultimo_servicio: null });
    expect(visitar.dias_sin_servicio).toBeGreaterThan(365);
    expect(t.equipos_para_visitar.some((x) => x.numero_serie === serieA)).toBe(false);
    const enero = t.por_mes.find((m) => m.mes === "2026-01");
    expect(enero.servicios).toBeGreaterThanOrEqual(2);
    expect(enero.fallas).toBeGreaterThanOrEqual(2);
    expect(t.ultimos_reportes.find((r) => r.id === ids.reportes[0]).minutos).toBe(120);
  });

  test("Entregas: pendientes de cierre, proyectos sin acta e ítems que no cumplen", async () => {
    const t = await obtenerTableroEntregas(pool, { hoy });
    const pendiente = t.pendientes_cierre.find((a) => a.id === ids.entregaAbierta);
    expect(pendiente).toMatchObject({ dias: 27, items_no_cumplen: 1 });
    expect(t.pendientes_cierre.some((a) => a.id === ids.entregaCerrada)).toBe(false);
    expect(t.proyectos_sin_acta.some((p) => p.id === ids.pInstalacion)).toBe(true);
    expect(t.proyectos_sin_acta.some((p) => p.id === ids.pSeguimiento)).toBe(false);
    expect(t.items_no_cumplen).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ acta_id: ids.entregaAbierta, elemento: "Manómetro de salida" }),
      ])
    );
    expect(t.kpis.entrega_a_cierre.muestras).toBeGreaterThanOrEqual(1);
  });

  test("los tres endpoints responden a cualquier usuario con sesión", async () => {
    for (const modulo of ["diseno", "soporte", "entregas"]) {
      const r = await request(app)
        .get(`/tableros/${modulo}`)
        .set("Authorization", `Bearer ${token}`);
      expect(r.status).toBe(200);
      expect(r.body.tablero).toHaveProperty("kpis");
      expect((await request(app).get(`/tableros/${modulo}`)).status).toBe(401);
    }
  });
});
