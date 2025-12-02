const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// ===================
// DASHBOARD - ESTADÍSTICAS
// ===================

// GET /api/admin/dashboard
router.get("/dashboard", async (req, res) => {
  try {
    // Total de pedidos
    const totalPedidos = await pool.query("SELECT COUNT(*) FROM pedidos");

    // Total de ventas
    const totalVentas = await pool.query(
      "SELECT SUM(total) FROM pedidos WHERE estado != $1",
      ["cancelado"]
    );

    // Pedidos pendientes
    const pedidosPendientes = await pool.query(
      "SELECT COUNT(*) FROM pedidos WHERE estado = $1",
      ["pendiente"]
    );

    // Productos más vendidos (top 5)
    const topProductos = await pool.query(`
      SELECT p.nombre, SUM(dp.cantidad) as total_vendido
      FROM detalle_pedidos dp
      JOIN productos p ON dp.producto_id = p.id
      JOIN pedidos ped ON dp.pedido_id = ped.id
      WHERE ped.estado != 'cancelado'
      GROUP BY p.id, p.nombre
      ORDER BY total_vendido DESC
      LIMIT 5
    `);

    // Ventas por día (últimos 7 días)
    const ventasPorDia = await pool.query(`
      SELECT DATE(created_at) as fecha, SUM(total) as ventas
      FROM pedidos 
      WHERE estado != 'cancelado' 
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY fecha ASC
    `);

    res.json({
      totalPedidos: totalPedidos.rows[0].count,
      totalVentas: totalVentas.rows[0].sum || 0,
      pedidosPendientes: pedidosPendientes.rows[0].count,
      topProductos: topProductos.rows,
      ventasPorDia: ventasPorDia.rows,
    });
  } catch (error) {
    console.error("Error en dashboard:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ===================
// GESTIÓN DE PRODUCTOS
// ===================

// GET /api/admin/productos - Obtener todos los productos
router.get("/productos", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM productos ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error obteniendo productos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/admin/productos - Crear nuevo producto
router.post("/productos", async (req, res) => {
  try {
    const { nombre, descripcion, precio, stock, categoria, imagen_url } =
      req.body;

    const result = await pool.query(
      "INSERT INTO productos (nombre, descripcion, precio, stock, categoria, imagen_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [nombre, descripcion, precio, stock, categoria, imagen_url]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creando producto:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /api/admin/productos/:id - Actualizar producto
router.put("/productos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock, categoria, imagen_url } =
      req.body;

    const result = await pool.query(
      "UPDATE productos SET nombre=$1, descripcion=$2, precio=$3, stock=$4, categoria=$5, imagen_url=$6, updated_at=NOW() WHERE id=$7 RETURNING *",
      [nombre, descripcion, precio, stock, categoria, imagen_url, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error actualizando producto:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// DELETE /api/admin/productos/:id - Eliminar producto
router.delete("/productos/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM productos WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ message: "Producto eliminado correctamente" });
  } catch (error) {
    console.error("Error eliminando producto:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ===================
// GESTIÓN DE PEDIDOS
// ===================

// GET /api/admin/pedidos - Obtener todos los pedidos
router.get("/pedidos", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        ARRAY_AGG(
          JSON_BUILD_OBJECT(
            'producto_nombre', pr.nombre,
            'cantidad', dp.cantidad,
            'precio_unitario', dp.precio_unitario
          )
        ) as items
      FROM pedidos p
      LEFT JOIN detalle_pedidos dp ON p.id = dp.pedido_id
      LEFT JOIN productos pr ON dp.producto_id = pr.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Error obteniendo pedidos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /api/admin/pedidos/:id/estado - Actualizar estado del pedido
router.put("/pedidos/:id/estado", async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = [
      "pendiente",
      "confirmado",
      "preparando",
      "enviado",
      "entregado",
      "cancelado",
    ];

    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: "Estado no válido" });
    }

    const result = await pool.query(
      "UPDATE pedidos SET estado = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error actualizando estado:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
