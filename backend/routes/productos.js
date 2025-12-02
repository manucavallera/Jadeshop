const express = require("express");
const router = express.Router();
const db = require("../config/database");

// GET /api/productos - Obtener todos los productos
router.get("/", async (req, res) => {
  try {
    const { categoria, activo = true } = req.query;

    let query = "SELECT * FROM productos WHERE activo = $1";
    let params = [activo];

    // Filtro por categoría si se proporciona
    if (categoria) {
      query += " AND categoria = $2";
      params.push(categoria);
    }

    query += " ORDER BY created_at DESC";

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Error obteniendo productos:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo productos",
      error: error.message,
    });
  }
});

// GET /api/productos/:id - Obtener producto por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query("SELECT * FROM productos WHERE id = $1", [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error obteniendo producto:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo producto",
      error: error.message,
    });
  }
});

// POST /api/productos - Crear nuevo producto
router.post("/", async (req, res) => {
  try {
    const {
      codigo,
      nombre,
      descripcion,
      precio,
      stock,
      categoria,
      imagen_url,
    } = req.body;

    // Validaciones básicas
    if (!nombre || !precio) {
      return res.status(400).json({
        success: false,
        message: "Nombre y precio son obligatorios",
      });
    }

    const result = await db.query(
      `INSERT INTO productos (codigo, nombre, descripcion, precio, stock, categoria, imagen_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
      [codigo, nombre, descripcion, precio, stock || 0, categoria, imagen_url]
    );

    res.status(201).json({
      success: true,
      message: "Producto creado exitosamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creando producto:", error);
    res.status(500).json({
      success: false,
      message: "Error creando producto",
      error: error.message,
    });
  }
});

// PUT /api/productos/:id - Actualizar producto
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      codigo,
      nombre,
      descripcion,
      precio,
      stock,
      categoria,
      imagen_url,
      activo,
    } = req.body;

    const result = await db.query(
      `UPDATE productos 
             SET codigo = COALESCE($1, codigo),
                 nombre = COALESCE($2, nombre),
                 descripcion = COALESCE($3, descripcion),
                 precio = COALESCE($4, precio),
                 stock = COALESCE($5, stock),
                 categoria = COALESCE($6, categoria),
                 imagen_url = COALESCE($7, imagen_url),
                 activo = COALESCE($8, activo)
             WHERE id = $9
             RETURNING *`,
      [
        codigo,
        nombre,
        descripcion,
        precio,
        stock,
        categoria,
        imagen_url,
        activo,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado",
      });
    }

    res.json({
      success: true,
      message: "Producto actualizado exitosamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error actualizando producto:", error);
    res.status(500).json({
      success: false,
      message: "Error actualizando producto",
      error: error.message,
    });
  }
});

// DELETE /api/productos/:id - Eliminar producto (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "UPDATE productos SET activo = false WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado",
      });
    }

    res.json({
      success: true,
      message: "Producto eliminado exitosamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error eliminando producto:", error);
    res.status(500).json({
      success: false,
      message: "Error eliminando producto",
      error: error.message,
    });
  }
});

// GET /api/productos/search/:termino - Buscar productos
router.get("/search/:termino", async (req, res) => {
  try {
    const { termino } = req.params;

    const result = await db.query(
      `SELECT * FROM productos 
             WHERE activo = true 
             AND (nombre ILIKE $1 OR descripcion ILIKE $1 OR codigo ILIKE $1)
             ORDER BY created_at DESC`,
      [`%${termino}%`]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      termino: termino,
    });
  } catch (error) {
    console.error("Error buscando productos:", error);
    res.status(500).json({
      success: false,
      message: "Error buscando productos",
      error: error.message,
    });
  }
});

module.exports = router;
