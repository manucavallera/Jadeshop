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
    },
  });
});

module.exports = router;
