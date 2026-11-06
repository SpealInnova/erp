const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");
const { sufijoUnico } = require("../helpers/unico");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Equipo de proyecto (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let miembroId;
  let clienteId;
  let proyectoId;
  let token;
  const correoUsuario = `proy-equipo-test-${Date.now()}@speal.test`;
  const correoMiembro = `proy-equipo-miembro-${Date.now()}@speal.test`;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-pruebas";
    pool = crearPool();

    const passwordHash = await bcrypt.hash("ClaveSegura123", 10);
    const [usuario] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
      ["Usuario de prueba", correoUsuario, passwordHash]
    );
    usuarioId = usuario.insertId;
    token = jwt.sign(
      { id: usuarioId, correo: correoUsuario, rol: "tester" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const [miembro] = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'tester', 1)",
      ["Miembro de equipo", correoMiembro, passwordHash]
    );
    miembroId = miembro.insertId;

    const [cliente] = await pool.query(
      `INSERT INTO clientes (nombre_razon_social, tipo_identificacion, numero_identificacion, created_by)
       VALUES (?, 'NIT', ?, ?)`,
      ["Cliente para Equipo", `PE-TEST-${Date.now()}`, usuarioId]
    );
    clienteId = cliente.insertId;

    const [proyecto] = await pool.query(
      `INSERT INTO proyectos (codigo_pry, cliente_id, nombre_proyecto, estado, responsable_id)
       VALUES (?, ?, 'Proyecto para Equipo', 'prospecto', ?)`,
      [`PRY-${sufijoUnico()}`, clienteId, usuarioId]
    );
    proyectoId = proyecto.insertId;

    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM proyecto_equipo WHERE proyecto_id = ?", [proyectoId]);
    await pool.query("DELETE FROM auditoria WHERE usuario_id IN (?, ?)", [usuarioId, miembroId]);
    await pool.query("DELETE FROM proyectos WHERE id = ?", [proyectoId]);
    await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await pool.query("DELETE FROM notificaciones WHERE usuario_id IN (?, ?)", [
      usuarioId,
      miembroId,
    ]);
    await pool.query("DELETE FROM usuarios WHERE id IN (?, ?)", [usuarioId, miembroId]);
    await pool.end();
  });

  const autorizacion = () => ({ Authorization: `Bearer ${token}` });
  let filaEquipoId;

  test("un proyecto recién creado no tiene equipo asignado", async () => {
    const respuesta = await request(app)
      .get(`/proyectos/${proyectoId}/equipo`)
      .set(autorizacion());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.equipo).toHaveLength(0);
  });

  test("rechaza agregar un usuario inexistente al equipo", async () => {
    const respuesta = await request(app)
      .post(`/proyectos/${proyectoId}/equipo`)
      .set(autorizacion())
      .send({ usuario_id: 999999999, rol_en_proyecto: "técnico" });
    expect(respuesta.status).toBe(400);
  });

  test("agrega un integrante al equipo", async () => {
    const respuesta = await request(app)
      .post(`/proyectos/${proyectoId}/equipo`)
      .set(autorizacion())
      .send({ usuario_id: miembroId, rol_en_proyecto: "técnico" });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.miembro.usuario_id).toBe(miembroId);
    expect(respuesta.body.miembro.rol_en_proyecto).toBe("técnico");
    expect(respuesta.body.miembro.usuario_nombre).toBe("Miembro de equipo");
    filaEquipoId = respuesta.body.miembro.id;

    const lista = await request(app)
      .get(`/proyectos/${proyectoId}/equipo`)
      .set(autorizacion());
    expect(lista.body.equipo).toHaveLength(1);
  });

  test("rechaza agregar dos veces al mismo integrante", async () => {
    const respuesta = await request(app)
      .post(`/proyectos/${proyectoId}/equipo`)
      .set(autorizacion())
      .send({ usuario_id: miembroId, rol_en_proyecto: "supervisor" });
    expect(respuesta.status).toBe(409);
  });

  test("quita a un integrante del equipo (soft-delete)", async () => {
    const respuesta = await request(app)
      .delete(`/proyectos/${proyectoId}/equipo/${filaEquipoId}`)
      .set(autorizacion());
    expect(respuesta.status).toBe(204);

    const lista = await request(app)
      .get(`/proyectos/${proyectoId}/equipo`)
      .set(autorizacion());
    expect(lista.body.equipo).toHaveLength(0);
  });

  test("permite volver a agregar a alguien que había sido quitado, con un rol distinto", async () => {
    const respuesta = await request(app)
      .post(`/proyectos/${proyectoId}/equipo`)
      .set(autorizacion())
      .send({ usuario_id: miembroId, rol_en_proyecto: "comercial" });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.miembro.id).toBe(filaEquipoId);
    expect(respuesta.body.miembro.rol_en_proyecto).toBe("comercial");
  });

  test("rechaza quitar un integrante de un proyecto inexistente", async () => {
    const respuesta = await request(app)
      .delete(`/proyectos/999999999/equipo/${filaEquipoId}`)
      .set(autorizacion());
    expect(respuesta.status).toBe(404);
  });

  test("rechaza quitar un integrante que no existe", async () => {
    const respuesta = await request(app)
      .delete(`/proyectos/${proyectoId}/equipo/999999999`)
      .set(autorizacion());
    expect(respuesta.status).toBe(404);
  });

  test("la línea de tiempo incluye el alta y la baja del equipo", async () => {
    const respuesta = await request(app)
      .get(`/proyectos/${proyectoId}/linea-tiempo`)
      .set(autorizacion());
    expect(respuesta.status).toBe(200);

    const eventos = respuesta.body.eventos.filter((e) => e.tabla === "proyecto_equipo");
    expect(eventos.length).toBeGreaterThanOrEqual(3);
    expect(eventos.some((e) => e.accion === "eliminar")).toBe(true);
    expect(eventos.every((e) => e.miembro_nombre === "Miembro de equipo")).toBe(true);
  });
});
