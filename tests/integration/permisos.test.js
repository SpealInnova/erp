const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { CLAVES } = require("../../src/dominio/permisos");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

// Permisos por cargo (dominio/permisos.js): el servidor valida cada acción
// restringida leyendo el cargo de la base, no del token. Quien crea una OC o
// un cambio de diseño no lo aprueba, salvo el Gerente General o el rol admin.
describirSiHayBD("Permisos por cargo (integración)", () => {
  let app;
  let pool;
  const sufijo = sufijoUnico();
  const PASSWORD = "ClaveSegura123";
  const u = {};
  const tokens = {};
  const ids = {};

  const PERFILES = {
    tecnico: { cargo: "Técnico Mantenimiento y Ensamble" },
    director: { cargo: "Director Administrativo y Financiero" },
    contador: { cargo: "Contador General" },
    comercial: { cargo: "Gerente Comercial" },
    disenador: { cargo: "Jefe de I+D+i" },
    jefeProyectos: { cargo: "Jefe de Proyectos" },
    gerente: { cargo: "Gerente General" },
    admin: { cargo: null, rol: "admin" },
    inactivo: { cargo: "Director Administrativo y Financiero", activo: 0 },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();
    const q = (sql, p) => pool.query(sql, p).then(([r]) => r);
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    for (const [clave, perfil] of Object.entries(PERFILES)) {
      const correo = `permisos-${clave}-${sufijo}@speal.test`.toLowerCase();
      const rol = perfil.rol || "tester";
      u[clave] = (
        await q(
          "INSERT INTO usuarios (nombre, correo, password_hash, rol, cargo, activo) VALUES (?, ?, ?, ?, ?, ?)",
          [
            `Permisos ${clave} ${sufijo}`,
            correo,
            passwordHash,
            rol,
            perfil.cargo,
            perfil.activo ?? 1,
          ]
        )
      ).insertId;
      tokens[clave] = jwt.sign({ id: u[clave], correo, rol }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
    }

    ids.cliente = (
      await q(
        `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
         VALUES (?, 'NIT', ?, ?)`,
        [`Cliente Permisos ${sufijo}`, `PER-${sufijo}`, u.gerente]
      )
    ).insertId;
    const proyecto = async (codigo) =>
      (
        await q(
          `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
           VALUES (?, ?, ?, 'planeacion', ?)`,
          [codigo, ids.cliente, `Proyecto ${codigo}`, u.jefeProyectos]
        )
      ).insertId;
    ids.proyecto = await proyecto(`PRY-PE-${sufijo}`);
    ids.proyectoSinDocs = await proyecto(`PRY-PX-${sufijo}`);
    ids.proveedor = (
      await q(
        `INSERT INTO proveedores (nit_cc, razon_social, tipo_persona, origen, clasificacion, created_by)
         VALUES (?, ?, 'juridica', 'nacional', 'productos', ?)`,
        [`PROV-PE-${sufijo}`, `Proveedor Permisos ${sufijo}`, u.gerente]
      )
    ).insertId;
    ids.requisicion = (
      await q(
        `INSERT INTO requisiciones (numero_requisicion, proyecto_id, solicitante_id, procedencia, estado)
         VALUES (?, ?, ?, 'nacional', 'convertida_oc')`,
        [`REQ-PE-${sufijo}`, ids.proyecto, u.tecnico]
      )
    ).insertId;
    let n = 0;
    ids.nuevaOC = async (creador) => {
      n += 1;
      return (
        await q(
          `INSERT INTO ordenes_compra (numero_oc, requisicion_id, proveedor_id, estado, created_by)
           VALUES (?, ?, ?, 'pte_aprobar', ?)`,
          [`OC-PE-${sufijo}-${n}`, ids.requisicion, ids.proveedor, creador]
        )
      ).insertId;
    };
    ids.nuevaCotizacion = async (estado) => {
      n += 1;
      return (
        await q(
          `INSERT INTO cotizaciones (numero_cotizacion, cliente_id, asesor_comercial_id, estado, created_by)
           VALUES (?, ?, ?, ?, ?)`,
          [`COT-PE-${sufijo}-${n}`, ids.cliente, u.comercial, estado, u.comercial]
        )
      ).insertId;
    };
    ids.nuevoExpediente = async () => {
      n += 1;
      return (
        await q(
          `INSERT INTO expedientes_diseno (codigo_expediente, proyecto_id, producto_nombre, responsable_diseno_id, estado_liberacion)
           VALUES (?, ?, 'Planta', ?, 'pendiente')`,
          [`EXP-PE-${sufijo}-${n}`, ids.proyecto, u.disenador]
        )
      ).insertId;
    };
    app = crearApp();
  });

  afterAll(async () => {
    const q = (sql, p) => pool.query(sql, p);
    const usuarios = Object.values(u);
    await q("DELETE FROM documento_versiones WHERE reemplazada_por IN (?)", [usuarios]);
    await q("DELETE FROM auditoria WHERE usuario_id IN (?)", [usuarios]);
    await q("DELETE FROM notificaciones WHERE usuario_id IN (?)", [usuarios]);
    await q(
      "DELETE oci FROM orden_compra_items oci JOIN ordenes_compra oc ON oc.id = oci.orden_compra_id WHERE oc.requisicion_id = ?",
      [ids.requisicion]
    );
    await q("DELETE FROM ordenes_compra WHERE requisicion_id = ?", [ids.requisicion]);
    await q("DELETE FROM requisiciones WHERE id = ?", [ids.requisicion]);
    await q("DELETE FROM proveedores WHERE id = ?", [ids.proveedor]);
    await q(
      "DELETE c FROM cambios_diseno c JOIN expedientes_diseno e ON e.id = c.expediente_id WHERE e.proyecto_id = ?",
      [ids.proyecto]
    );
    await q("DELETE FROM expedientes_diseno WHERE proyecto_id = ?", [ids.proyecto]);
    await q(
      "DELETE FROM cotizacion_items WHERE cotizacion_id IN (SELECT id FROM cotizaciones WHERE cliente_id = ?)",
      [ids.cliente]
    );
    await q("DELETE FROM cotizaciones WHERE cliente_id = ?", [ids.cliente]);
    await q("DELETE FROM proyecto_actividades WHERE proyecto_id IN (?, ?)", [
      ids.proyecto,
      ids.proyectoSinDocs,
    ]);
    await q("DELETE FROM proyectos WHERE id IN (?, ?)", [ids.proyecto, ids.proyectoSinDocs]);
    await q("DELETE FROM clientes WHERE id = ?", [ids.cliente]);
    await q("DELETE FROM usuarios WHERE id IN (?)", [usuarios]);
    await pool.end();
  });

  const como = (quien) => ({ Authorization: `Bearer ${tokens[quien]}` });
  const patch = (quien, ruta, cuerpo) => request(app).patch(ruta).set(como(quien)).send(cuerpo);
  const post = (quien, ruta, cuerpo) => request(app).post(ruta).set(como(quien)).send(cuerpo);
  const put = (quien, ruta, cuerpo) => request(app).put(ruta).set(como(quien)).send(cuerpo);
  const fila = async (tabla, id) =>
    (await pool.query(`SELECT * FROM ${tabla} WHERE id = ?`, [id]))[0][0];
  const auditadoPor = async (tabla, id, usuario) =>
    (
      await pool.query(
        "SELECT COUNT(*) AS n FROM auditoria WHERE tabla = ? AND registro_id = ? AND usuario_id = ?",
        [tabla, id, usuario]
      )
    )[0][0].n;

  describe("Perfil", () => {
    test("devuelve cargo y permisos leídos de la base", async () => {
      const tecnico = await request(app).get("/auth/perfil").set(como("tecnico"));
      expect(tecnico.status).toBe(200);
      expect(tecnico.body.usuario).toMatchObject({ id: u.tecnico, cargo: PERFILES.tecnico.cargo });
      expect(tecnico.body.usuario.permisos).toEqual([]);
      expect(tecnico.body.usuario.superusuario).toBe(false);

      const director = await request(app).get("/auth/perfil").set(como("director"));
      expect(director.body.usuario.permisos).toEqual(
        expect.arrayContaining(["aprobar_oc", "pagar_oc", "versionar_oc"])
      );
      expect(director.body.usuario.permisos).not.toContain("aprobar_diseno");

      for (const superusuario of ["gerente", "admin"]) {
        const r = await request(app).get("/auth/perfil").set(como(superusuario));
        expect(r.body.usuario.permisos).toEqual(CLAVES);
        expect(r.body.usuario.superusuario).toBe(true);
      }
      const inactivo = await request(app).get("/auth/perfil").set(como("inactivo"));
      expect(inactivo.body.usuario.permisos).toEqual([]);
    });
  });

  describe("Órdenes de compra", () => {
    test("aprobar exige el cargo, y la auditoría no registra el intento rechazado", async () => {
      const oc = await ids.nuevaOC(u.tecnico);
      const r = await patch("tecnico", `/ordenes-compra/${oc}/estado`, {
        estado: "aprobada_pte_pago",
      });
      expect(r.status).toBe(403);
      expect(r.body.error).toMatch(/Director Administrativo y Financiero/);
      expect((await fila("ordenes_compra", oc)).estado).toBe("pte_aprobar");
      expect(await auditadoPor("ordenes_compra", oc, u.tecnico)).toBe(0);

      const ok = await patch("director", `/ordenes-compra/${oc}/estado`, {
        estado: "aprobada_pte_pago",
      });
      expect(ok.status).toBe(200);
      expect(ok.body.orden.aprobado_por).toBe(u.director);
      expect(await auditadoPor("ordenes_compra", oc, u.director)).toBe(1);
    });

    test("quien creó la OC no la aprueba, salvo el Gerente General", async () => {
      const propia = await ids.nuevaOC(u.director);
      const r = await patch("director", `/ordenes-compra/${propia}/estado`, {
        estado: "aprobada_pte_pago",
      });
      expect(r.status).toBe(403);
      expect(r.body.error).toMatch(/tú mismo creaste/);

      const delGerente = await ids.nuevaOC(u.gerente);
      const ok = await patch("gerente", `/ordenes-compra/${delGerente}/estado`, {
        estado: "aprobada_pte_pago",
      });
      expect(ok.status).toBe(200);
    });

    test("pagar y contabilizar exigen su cargo; un usuario inactivo no puede", async () => {
      const oc = await ids.nuevaOC(u.tecnico);
      expect(
        (await patch("admin", `/ordenes-compra/${oc}/estado`, { estado: "aprobada_pte_pago" }))
          .status
      ).toBe(200);
      expect(
        (await patch("inactivo", `/ordenes-compra/${oc}/estado`, { estado: "paga" })).status
      ).toBe(403);
      expect(
        (await patch("tecnico", `/ordenes-compra/${oc}/estado`, { estado: "paga" })).status
      ).toBe(403);
      expect(
        (await patch("contador", `/ordenes-compra/${oc}/estado`, { estado: "paga" })).status
      ).toBe(200);
      expect(
        (await patch("comercial", `/ordenes-compra/${oc}/estado`, { estado: "contabilizada" }))
          .status
      ).toBe(403);
      expect(
        (await patch("contador", `/ordenes-compra/${oc}/estado`, { estado: "contabilizada" }))
          .status
      ).toBe(200);
    });

    test("crear una versión exige el cargo", async () => {
      const oc = await ids.nuevaOC(u.tecnico);
      const motivo = "Corrige la fecha de entrega pactada";
      expect((await post("tecnico", `/ordenes-compra/${oc}/versiones`, { motivo })).status).toBe(
        403
      );
      expect((await post("director", `/ordenes-compra/${oc}/versiones`, { motivo })).status).toBe(
        200
      );
    });
  });

  describe("Cotizaciones", () => {
    test("solo quien aprueba cotizaciones decide una que está en aprobación", async () => {
      const cot = await ids.nuevaCotizacion("aprobacion");
      expect(
        (await patch("tecnico", `/cotizaciones/${cot}/estado`, { estado: "enviada" })).status
      ).toBe(403);
      expect(
        (await patch("tecnico", `/cotizaciones/${cot}/estado`, { estado: "borrador" })).status
      ).toBe(403);
      expect(
        (await patch("comercial", `/cotizaciones/${cot}/estado`, { estado: "enviada" })).status
      ).toBe(200);
    });

    test("los pasos previos a la aprobación siguen abiertos", async () => {
      const cot = await ids.nuevaCotizacion("borrador");
      expect(
        (await patch("tecnico", `/cotizaciones/${cot}/estado`, { estado: "revision" })).status
      ).toBe(200);
      expect(
        (await patch("tecnico", `/cotizaciones/${cot}/estado`, { estado: "aprobacion" })).status
      ).toBe(200);
    });
  });

  describe("Diseño", () => {
    test("liberar un expediente exige el cargo", async () => {
      const exp = await ids.nuevoExpediente();
      expect(
        (await patch("tecnico", `/expedientes-diseno/${exp}/estado`, { estado: "aprobado" })).status
      ).toBe(403);
      expect(
        (await patch("disenador", `/expedientes-diseno/${exp}/estado`, { estado: "aprobado" }))
          .status
      ).toBe(200);
    });

    test("un cambio lo decide alguien con el cargo que no lo creó", async () => {
      const exp = await ids.nuevoExpediente();
      const base = `/expedientes-diseno/${exp}/cambios-diseno`;
      const creado = await post("disenador", base, {
        descripcion: "Cambia la válvula",
        estado: "pendiente",
      });
      expect(creado.status).toBe(201);
      const id = creado.body.cambio.id;

      expect((await put("tecnico", `${base}/${id}`, { estado: "aprobado" })).status).toBe(403);
      const propio = await put("disenador", `${base}/${id}`, { estado: "aprobado" });
      expect(propio.status).toBe(403);
      expect(propio.body.error).toMatch(/tú mismo creaste/);

      const aprobado = await put("admin", `${base}/${id}`, { estado: "aprobado" });
      expect(aprobado.status).toBe(200);
      expect(aprobado.body.cambio.aprobado_por).toBe(u.admin);

      // ya decidido: editarlo exige el cargo, y reenviar el mismo estado no cambia quién aprobó
      expect((await put("tecnico", `${base}/${id}`, { motivo: "otro" })).status).toBe(403);
      const editado = await put("gerente", `${base}/${id}`, {
        motivo: "Precisión",
        estado: "aprobado",
      });
      expect(editado.body.cambio.aprobado_por).toBe(u.admin);

      // al rechazarlo se limpia quién aprobó
      const rechazado = await put("gerente", `${base}/${id}`, { estado: "rechazado" });
      expect(rechazado.status).toBe(200);
      expect(rechazado.body.cambio.aprobado_por).toBeNull();
      expect(rechazado.body.cambio.aprobado_en).toBeNull();
    });

    test("crear un cambio ya aprobado solo lo puede el Gerente General o admin", async () => {
      const exp = await ids.nuevoExpediente();
      const base = `/expedientes-diseno/${exp}/cambios-diseno`;
      expect((await post("disenador", base, { descripcion: "x", estado: "aprobado" })).status).toBe(
        403
      );
      expect((await post("tecnico", base, { descripcion: "x" })).status).toBe(201);
      expect((await post("gerente", base, { descripcion: "y", estado: "aprobado" })).status).toBe(
        201
      );
    });
  });

  describe("Proyectos", () => {
    test("cancelar exige el cargo; las demás fases siguen abiertas", async () => {
      expect(
        (await patch("tecnico", `/proyectos/${ids.proyecto}/estado`, { estado: "cancelado" }))
          .status
      ).toBe(403);
      expect(
        (await patch("tecnico", `/proyectos/${ids.proyecto}/estado`, { estado: "diseno" })).status
      ).toBe(200);
      expect(
        (await patch("jefeProyectos", `/proyectos/${ids.proyecto}/estado`, { estado: "cancelado" }))
          .status
      ).toBe(200);
    });

    test("eliminar exige el cargo antes de revisar la contraseña", async () => {
      const cuerpo = { password: PASSWORD, justificacion: "Creado por error" };
      const r = await request(app)
        .delete(`/proyectos/${ids.proyectoSinDocs}`)
        .set(como("tecnico"))
        .send(cuerpo);
      expect(r.status).toBe(403);
      expect(r.body.error).toMatch(/Cancelar o eliminar proyectos/);
      expect((await fila("proyectos", ids.proyectoSinDocs)).deleted_at).toBeNull();
    });

    test("crear una versión exige el cargo", async () => {
      const cuerpo = { nombre_proyecto: "Nombre corregido", motivo: "Así figura en el contrato" };
      expect(
        (await post("tecnico", `/proyectos/${ids.proyectoSinDocs}/versiones`, cuerpo)).status
      ).toBe(403);
      expect(
        (await post("jefeProyectos", `/proyectos/${ids.proyectoSinDocs}/versiones`, cuerpo)).status
      ).toBe(200);
    });
  });
});
