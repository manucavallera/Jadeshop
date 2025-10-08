const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const pool = require("../config/database");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email y contraseña son requeridos",
      });
    }

    // Buscar comerciante por email
    const result = await pool.query(
      "SELECT * FROM comerciantes WHERE email = $1 AND activo = true",
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Email o contraseña incorrectos",
      });
    }

    const comerciante = result.rows[0];

    // Verificar contraseña
    const validPassword = await bcrypt.compare(
      password,
      comerciante.password_hash
    );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Email o contraseña incorrectos",
      });
    }

    // Guardar en sesión
    req.session.comerciante_id = comerciante.id;
    req.session.comerciante_email = comerciante.email;
    req.session.comerciante_nombre = comerciante.nombre;
    req.session.comerciante_slug = comerciante.slug; // ← AGREGAR ESTA LÍNEA

    res.json({
      success: true,
      message: "Login exitoso",
      comerciante: {
        id: comerciante.id,
        nombre: comerciante.nombre,
        email: comerciante.email,
        slug: comerciante.slug,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error cerrando sesión:", err);
      return res.status(500).json({
        success: false,
        message: "Error cerrando sesión",
      });
    }
    res.json({
      success: true,
      message: "Sesión cerrada correctamente",
    });
  });
});

// GET /api/auth/me - Obtener datos del usuario logueado
router.get("/me", (req, res) => {
  if (!req.session.comerciante_id) {
    return res.status(401).json({
      success: false,
      message: "No hay sesión activa",
    });
  }

  res.json({
    success: true,
    comerciante: {
      id: req.session.comerciante_id,
      email: req.session.comerciante_email,
      nombre: req.session.comerciante_nombre,
      slug: req.session.comerciante_slug,
    },
  });
});

// POST /api/auth/register - Registro de nuevos comerciantes
router.post("/register", async (req, res) => {
  try {
    const {
      plan,
      nombreComercio,
      nombreUsuario,
      rubroComercio,
      whatsapp,
      pais,
      email,
      password,
    } = req.body;

    // Verificar que el slug no exista
    const slugCheck = await pool.query(
      "SELECT id FROM comerciantes WHERE slug = $1",
      [nombreUsuario.toLowerCase()]
    );

    if (slugCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Este nombre de usuario ya está en uso",
      });
    }

    // Verificar que el email no exista
    const emailCheck = await pool.query(
      "SELECT id FROM comerciantes WHERE email = $1",
      [email.toLowerCase()]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Este email ya está registrado",
      });
    }

    // Hash de contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    // Insertar comerciante
    const result = await pool.query(
      `INSERT INTO comerciantes (nombre, slug, email, password_hash, whatsapp, pais, rubro, plan, mercadopago_subscription_id, activo)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
   RETURNING id, nombre, slug, email`,
      [
        nombreComercio,
        nombreUsuario.toLowerCase(),
        email.toLowerCase(),
        hashedPassword,
        whatsapp,
        pais,
        rubroComercio,
        plan,
        req.body.subscription_id || null,
      ]
    );

    const comerciante = result.rows[0];

    // Crear tienda asociada
    await pool.query(
      `INSERT INTO tiendas (comerciante_id, nombre, subdominio, activa)
   VALUES ($1, $2, $3, true)`,
      [comerciante.id, nombreComercio, nombreUsuario.toLowerCase()]
    );

    // Crear sesión automáticamente
    req.session.comerciante_id = comerciante.id;
    req.session.comerciante_email = comerciante.email;
    req.session.comerciante_nombre = comerciante.nombre;
    req.session.comerciante_slug = comerciante.slug;

    res.json({
      success: true,
      message: "Tienda creada exitosamente",
      comerciante: comerciante,
    });
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({
      success: false,
      message: "Error al crear la tienda: " + error.message,
    });
  }
});

module.exports = router;
