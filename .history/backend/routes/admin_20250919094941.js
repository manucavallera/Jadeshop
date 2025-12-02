const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// ===================
// MIDDLEWARE DE AUTENTICACIÓN TEMPORAL
// ===================

// Por ahora, usaremos un query parameter para identificar al comerciante
// Más adelante se puede implementar un sistema de login completo
const requireAuth = (req, res, next) => {
  if (!req.session.comerciante_id) {
    return res.status(401).json({
      success: false,
      message: "Sesión requerida",
    });
  }

  req.comerciante_id = req.session.comerciante_id;
  next();
};

// ===================
// DASHBOARD - ESTADÍSTICAS
// ===================

// GET /api/admin/dashboard?comerciante_id=X
router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const { comerciante_id } = req;

    // Total de pedidos del comerciante
    const totalPedidos = await pool.query(
      "SELECT COUNT(*) FROM pedidos WHERE comerciante_id = $1",
      [comerciante_id]
    );

    // Total de ventas del comerciante
    const totalVentas = await pool.query(
      "SELECT SUM(total) FROM pedidos WHERE estado != $1 AND comerciante_id = $2",
      ["cancelado", comerciante_id]
    );

    // Pedidos pendientes del comerciante
    const pedidosPendientes = await pool.query(
      "SELECT COUNT(*) FROM pedidos WHERE estado = $1 AND comerciante_id = $2",
      ["pendiente", comerciante_id]
    );

    // Total productos del comerciante
    const totalProductos = await pool.query(
      "SELECT COUNT(*) FROM productos WHERE comerciante_id = $1 AND activo = true",
      [comerciante_id]
    );

    // Productos más vendidos del comerciante (top 5)
    const topProductos = await pool.query(
      `
      SELECT p.nombre, SUM(dp.cantidad) as total_vendido
      FROM detalle_pedidos dp
      JOIN productos p ON dp.producto_id = p.id
      JOIN pedidos ped ON dp.pedido_id = ped.id
      WHERE ped.estado != 'cancelado' AND p.comerciante_id = $1
      GROUP BY p.id, p.nombre
      ORDER BY total_vendido DESC
      LIMIT 5
    `,
      [comerciante_id]
    );

    // Ventas por día del comerciante (últimos 7 días)
    const ventasPorDia = await pool.query(
      `
      SELECT DATE(created_at) as fecha, SUM(total) as ventas
      FROM pedidos 
      WHERE estado != 'cancelado' 
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      AND comerciante_id = $1
      GROUP BY DATE(created_at)
      ORDER BY fecha ASC
    `,
      [comerciante_id]
    );

    res.json({
      totalPedidos: totalPedidos.rows[0].count,
      totalVentas: totalVentas.rows[0].sum || 0,
      pedidosPendientes: pedidosPendientes.rows[0].count,
      totalProductos: totalProductos.rows[0].count,
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

// GET /api/admin/productos?comerciante_id=X - Obtener productos del comerciante
router.get("/productos", requireAuth, async (req, res) => {
  try {
    const { comerciante_id } = req;

    const result = await pool.query(
      "SELECT * FROM productos WHERE comerciante_id = $1 ORDER BY created_at DESC",
      [comerciante_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error obteniendo productos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/admin/productos - Crear nuevo producto
router.post("/productos", requireAuth, async (req, res) => {
  try {
    const { comerciante_id } = req;
    const { nombre, descripcion, precio, stock, categoria, imagen_url } =
      req.body;

    const result = await pool.query(
      "INSERT INTO productos (comerciante_id, nombre, descripcion, precio, stock, categoria, imagen_url, activo) VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *",
      [
        comerciante_id,
        nombre,
        descripcion,
        precio,
        stock,
        categoria,
        imagen_url,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creando producto:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /api/admin/productos/:id - Actualizar producto
router.put("/productos/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { comerciante_id } = req;
    const { nombre, descripcion, precio, stock, categoria, imagen_url } =
      req.body;

    const result = await pool.query(
      "UPDATE productos SET nombre=$1, descripcion=$2, precio=$3, stock=$4, categoria=$5, imagen_url=$6, updated_at=NOW() WHERE id=$7 AND comerciante_id=$8 RETURNING *",
      [
        nombre,
        descripcion,
        precio,
        stock,
        categoria,
        imagen_url,
        id,
        comerciante_id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Producto no encontrado o no pertenece a este comerciante",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error actualizando producto:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// DELETE /api/admin/productos/:id - Eliminar producto
router.delete("/productos/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { comerciante_id } = req;

    const result = await pool.query(
      "UPDATE productos SET activo = false WHERE id = $1 AND comerciante_id = $2 RETURNING *",
      [id, comerciante_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Producto no encontrado o no pertenece a este comerciante",
      });
    }

    res.json({ message: "Producto desactivado correctamente" });
  } catch (error) {
    console.error("Error eliminando producto:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ===================
// GESTIÓN DE PEDIDOS
// ===================

// GET /api/admin/pedidos?comerciante_id=X - Obtener pedidos del comerciante
router.get("/pedidos", getComercianteId, async (req, res) => {
  try {
    const { comerciante_id } = req;

    const result = await pool.query(
      `
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
      WHERE p.comerciante_id = $1
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `,
      [comerciante_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error obteniendo pedidos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /api/admin/pedidos/:id/estado - Actualizar estado del pedido
router.put("/pedidos/:id/estado", getComercianteId, async (req, res) => {
  try {
    const { id } = req.params;
    const { comerciante_id } = req;
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
      "UPDATE pedidos SET estado = $1, updated_at = NOW() WHERE id = $2 AND comerciante_id = $3 RETURNING *",
      [estado, id, comerciante_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Pedido no encontrado o no pertenece a este comerciante",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error actualizando estado:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ===================
// INFORMACIÓN DEL COMERCIANTE
// ===================

// GET /api/admin/comerciante/:id - Obtener datos del comerciante
router.get("/comerciante/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT c.*, t.* 
      FROM comerciantes c 
      LEFT JOIN tiendas t ON c.id = t.comerciante_id 
      WHERE c.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Comerciante no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error obteniendo comerciante:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
