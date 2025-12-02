// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// POST /api/auth/login-telefono
router.post("/login-telefono", async (req, res) => {
  try {
    const { telefono, nombre, email } = req.body;

    // Buscar o crear usuario
    let result = await pool.query(
      "SELECT * FROM usuarios WHERE telefono = $1",
      [telefono]
    );

    if (result.rows.length === 0) {
      // Crear nuevo usuario
      result = await pool.query(
        "INSERT INTO usuarios (telefono, nombre, email) VALUES ($1, $2, $3) RETURNING *",
        [telefono, nombre || null, email || null]
      );
    } else {
      // Actualizar datos si se proporcionaron
      if (nombre || email) {
        result = await pool.query(
          "UPDATE usuarios SET nombre = COALESCE($2, nombre), email = COALESCE($3, email) WHERE telefono = $1 RETURNING *",
          [telefono, nombre, email]
        );
      }
    }

    const usuario = result.rows[0];

    res.json({
      success: true,
      usuario: {
        id: usuario.id,
        telefono: usuario.telefono,
        nombre: usuario.nombre,
        email: usuario.email,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
