const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { crearApp } = require("../../src/app");
const { crearPool } = require("../../src/config/db");

const hayBaseDeDatos = Boolean(process.env.DB_HOST);
const describirSiHayBD = hayBaseDeDatos ? describe : describe.skip;

describirSiHayBD("Listado de usuarios (integración contra BD real)", () => {
  let app;
  let pool;
  let usuarioId;
  let token;
  const correoUsuario = `usuarios-test-${Date.now()}@speal.test`;

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
    app = crearApp();
  });

  afterAll(async () => {
    await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  test("rechaza sin token", async () => {
    const respuesta = await request(app).get("/usuarios");
    expect(respuesta.status).toBe(401);
  });

  test("lista usuarios activos sin exponer la contraseña", async () => {
    const respuesta = await request(app)
      .get("/usuarios")
      .set("Authorization", `Bearer ${token}`);
    expect(respuesta.status).toBe(200);
    const encontrado = respuesta.body.usuarios.find((u) => u.id === usuarioId);
    expect(encontrado).toBeDefined();
    expect(encontrado.password_hash).toBeUndefined();
  });

  describe("creación de usuarios (POST /usuarios)", () => {
    let tokenAdmin;
    let adminId;
    let nuevoUsuarioId;
    const sufijo = Date.now().toString().slice(-8);
    const correoNuevo = `nuevo-usuario-${sufijo}@speal.test`;
    const cedulaNueva = `CC-${sufijo}`;

    beforeAll(async () => {
      const passwordHashAdmin = await bcrypt.hash("ClaveSegura123", 10);
      const [admin] = await pool.query(
        "INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES (?, ?, ?, 'admin', 1)",
        ["Admin de prueba", `admin-test-${sufijo}@speal.test`, passwordHashAdmin]
      );
      adminId = admin.insertId;
      tokenAdmin = jwt.sign(
        { id: adminId, correo: `admin-test-${sufijo}@speal.test`, rol: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );
    });

    afterAll(async () => {
      await pool.query("DELETE FROM auditoria WHERE usuario_id = ?", [adminId]);
      if (nuevoUsuarioId) {
        await pool.query("DELETE FROM usuarios WHERE id = ?", [nuevoUsuarioId]);
      }
      await pool.query("DELETE FROM usuarios WHERE id = ?", [adminId]);
    });

    test("rechaza crear usuario sin rol admin", async () => {
      const respuesta = await request(app)
        .post("/usuarios")
        .set("Authorization", `Bearer ${token}`)
        .send({
          nombre: "Usuario sin permiso",
          correo: `sin-permiso-${sufijo}@speal.test`,
          cedula: `CC-X-${sufijo}`,
          password: "ClaveSegura123",
          rol: "tester",
          cargo: "Auxiliar contable",
        });
      expect(respuesta.status).toBe(403);
    });

    test("rechaza un cargo que no está en el catálogo cerrado", async () => {
      const respuesta = await request(app)
        .post("/usuarios")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({
          nombre: "Usuario cargo inválido",
          correo: `cargo-invalido-${sufijo}@speal.test`,
          cedula: `CC-Y-${sufijo}`,
          password: "ClaveSegura123",
          rol: "tester",
          cargo: "Cargo que no existe",
        });
      expect(respuesta.status).toBe(400);
    });

    test("crea un usuario con cedula y cargo del catálogo", async () => {
      const respuesta = await request(app)
        .post("/usuarios")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({
          nombre: "Usuario Nuevo",
          correo: correoNuevo,
          cedula: cedulaNueva,
          password: "ClaveSegura123",
          rol: "tester",
          cargo: "Auxiliar contable",
        });
      expect(respuesta.status).toBe(201);
      nuevoUsuarioId = respuesta.body.usuario.id;
      expect(respuesta.body.usuario.cargo).toBe("Auxiliar contable");
      expect(respuesta.body.usuario.password_hash).toBeUndefined();
    });

    test("rechaza un correo duplicado", async () => {
      const respuesta = await request(app)
        .post("/usuarios")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({
          nombre: "Otro usuario",
          correo: correoNuevo,
          cedula: `CC-Z-${sufijo}`,
          password: "ClaveSegura123",
          rol: "tester",
          cargo: "Auxiliar contable",
        });
      expect(respuesta.status).toBe(409);
    });

    test("rechaza una cedula duplicada", async () => {
      const respuesta = await request(app)
        .post("/usuarios")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({
          nombre: "Otro usuario más",
          correo: `otro-mas-${sufijo}@speal.test`,
          cedula: cedulaNueva,
          password: "ClaveSegura123",
          rol: "tester",
          cargo: "Auxiliar contable",
        });
      expect(respuesta.status).toBe(409);
    });

    describe("edición de usuarios (PUT /usuarios/:id)", () => {
      test("rechaza editar sin rol admin", async () => {
        const respuesta = await request(app)
          .put(`/usuarios/${nuevoUsuarioId}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ nombre: "Intento sin permiso" });
        expect(respuesta.status).toBe(403);
      });

      test("actualiza el nombre, cargo y rol de un usuario", async () => {
        const respuesta = await request(app)
          .put(`/usuarios/${nuevoUsuarioId}`)
          .set("Authorization", `Bearer ${tokenAdmin}`)
          .send({ nombre: "Usuario Editado", cargo: "Jefe de Control de Calidad", rol: "calidad" });
        expect(respuesta.status).toBe(200);
        expect(respuesta.body.usuario.nombre).toBe("Usuario Editado");
        expect(respuesta.body.usuario.cargo).toBe("Jefe de Control de Calidad");
        expect(respuesta.body.usuario.rol).toBe("calidad");
        expect(respuesta.body.usuario.password_hash).toBeUndefined();
      });

      test("rechaza editar con un correo que ya usa otro usuario", async () => {
        const respuesta = await request(app)
          .put(`/usuarios/${nuevoUsuarioId}`)
          .set("Authorization", `Bearer ${tokenAdmin}`)
          .send({ correo: correoUsuario });
        expect(respuesta.status).toBe(409);
      });

      test("rechaza editar un usuario inexistente", async () => {
        const respuesta = await request(app)
          .put("/usuarios/999999999")
          .set("Authorization", `Bearer ${tokenAdmin}`)
          .send({ nombre: "No existe" });
        expect(respuesta.status).toBe(404);
      });
    });
  });
});
