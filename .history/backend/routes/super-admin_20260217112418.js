const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const pool = require("../config/database");

// Plataforma que filtra este super admin (definida en .env)
const PLATAFORMA = process.env.PLATAFORMA || "mentes";

// ===================
// MIDDLEWARE SUPER ADMIN
// ===================
const requireSuperAdmin = (req, res, next) => {
  if (!req.session.is_super_admin) {
    return res.status(401).json({
      success: false,
      message: "Acceso no autorizado",
    });
  }
  next();
};

// ===================
// AUTH SUPER ADMIN
// ===================

// POST /api/super-admin/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const adminEmail = process.env.SUPER_ADMIN_EMAIL;
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      return res.status(500).json({
        success: false,
        message: "Super Admin no configurado en el servidor",
      });
    }

    if (email !== adminEmail || password !== adminPassword) {
      return res.status(401).json({
        success: false,
        message: "Credenciales incorrectas",
      });
    }

    req.session.is_super_admin = true;
    req.session.super_admin_email = email;

    res.json({
      success: true,
      message: "Login exitoso",
    });
  } catch (error) {
    console.error("Error en super admin login:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

// POST /api/super-admin/logout
router.post("/logout", (req, res) => {
  req.session.is_super_admin = false;
  req.session.super_admin_email = null;
  res.json({ success: true, message: "Sesión cerrada" });
});

// GET /api/super-admin/me
router.get("/me", (req, res) => {
  if (!req.session.is_super_admin) {
    return res.status(401).json({ success: false });
  }
  res.json({
    success: true,
    email: req.session.super_admin_email,
  });
});

// ===================
// DASHBOARD
// ===================

router.get("/dashboard", requireSuperAdmin, async (req, res) => {
  try {
    const totalComerciantes = await pool.query(
      "SELECT COUNT(*) FROM comerciantes WHERE plataforma = $1",
      [PLATAFORMA],
    );

    const comerciantesActivos = await pool.query(
      "SELECT COUNT(*) FROM comerciantes WHERE activo = true AND plataforma = $1",
      [PLATAFORMA],
    );

    const comerciantesInactivos = await pool.query(
      "SELECT COUNT(*) FROM comerciantes WHERE activo = false AND plataforma = $1",
      [PLATAFORMA],
    );

    const porPlan = await pool.query(
      "SELECT COALESCE(plan, 'gratis') as plan, COUNT(*) FROM comerciantes WHERE plataforma = $1 GROUP BY COALESCE(plan, 'gratis') ORDER BY count DESC",
      [PLATAFORMA],
    );

    const totalProductos = await pool.query(
      "SELECT COUNT(*) FROM productos WHERE activo = true AND comerciante_id IN (SELECT id FROM comerciantes WHERE plataforma = $1)",
      [PLATAFORMA],
    );

    const totalPedidos = await pool.query(
      "SELECT COUNT(*) FROM pedidos WHERE comerciante_id IN (SELECT id FROM comerciantes WHERE plataforma = $1)",
      [PLATAFORMA],
    );

    const ventasTotales = await pool.query(
      "SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE estado IN ('confirmado', 'preparando', 'enviado', 'entregado') AND comerciante_id IN (SELECT id FROM comerciantes WHERE plataforma = $1)",
      [PLATAFORMA],
    );

    const registrosRecientes = await pool.query(
      "SELECT COUNT(*) FROM comerciantes WHERE created_at >= NOW() - INTERVAL '30 days' AND plataforma = $1",
      [PLATAFORMA],
    );

    const topTiendas = await pool.query(
      `SELECT c.nombre, c.slug, COUNT(p.id) as total_pedidos, COALESCE(SUM(p.total), 0) as total_ventas
       FROM comerciantes c
       LEFT JOIN pedidos p ON c.id = p.comerciante_id
       WHERE c.plataforma = $1
       GROUP BY c.id, c.nombre, c.slug
       ORDER BY total_pedidos DESC
       LIMIT 5`,
      [PLATAFORMA],
    );

    res.json({
      success: true,
      data: {
        totalComerciantes: parseInt(totalComerciantes.rows[0].count),
        comerciantesActivos: parseInt(comerciantesActivos.rows[0].count),
        comerciantesInactivos: parseInt(comerciantesInactivos.rows[0].count),
        porPlan: porPlan.rows,
        totalProductos: parseInt(totalProductos.rows[0].count),
        totalPedidos: parseInt(totalPedidos.rows[0].count),
        ventasTotales: parseFloat(ventasTotales.rows[0].total),
        registrosRecientes: parseInt(registrosRecientes.rows[0].count),
        topTiendas: topTiendas.rows,
      },
    });
  } catch (error) {
    console.error("Error en dashboard super admin:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

// ===================
// GESTIÓN DE COMERCIANTES
// ===================

router.get("/comerciantes", requireSuperAdmin, async (req, res) => {
  try {
    const { search, plan, activo, sort } = req.query;

    let query = `
      SELECT 
        c.id, c.nombre, c.email, c.slug, c.whatsapp, c.pais, c.rubro,
        c.plan, c.activo, c.created_at,
        t.nombre as tienda_nombre, t.subdominio, t.activa as tienda_activa, t.logo_url,
        (SELECT COUNT(*) FROM productos WHERE comerciante_id = c.id AND activo = true) as total_productos,
        (SELECT COUNT(*) FROM pedidos WHERE comerciante_id = c.id) as total_pedidos,
        (SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE comerciante_id = c.id AND estado IN ('confirmado', 'preparando', 'enviado', 'entregado')) as total_ventas
      FROM comerciantes c
      LEFT JOIN tiendas t ON c.id = t.comerciante_id
    `;

    const conditions = [`c.plataforma = $1`];
    const params = [PLATAFORMA];
    let paramIndex = 2;

    if (search) {
      conditions.push(
        `(c.nombre ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR c.slug ILIKE $${paramIndex})`,
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (plan) {
      conditions.push(`COALESCE(c.plan, 'gratis') = $${paramIndex}`);
      params.push(plan);
      paramIndex++;
    }

    if (activo !== undefined && activo !== "") {
      conditions.push(`c.activo = $${paramIndex}`);
      params.push(activo === "true");
      paramIndex++;
    }

    query += " WHERE " + conditions.join(" AND ");

    switch (sort) {
      case "nombre":
        query += " ORDER BY c.nombre ASC";
        break;
      case "pedidos":
        query += " ORDER BY total_pedidos DESC";
        break;
      case "ventas":
        query += " ORDER BY total_ventas DESC";
        break;
      case "antiguos":
        query += " ORDER BY c.created_at ASC";
        break;
      default:
        query += " ORDER BY c.created_at DESC";
    }

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Error listando comerciantes:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

router.get("/comerciantes/:id", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        c.*, 
        t.nombre as tienda_nombre, t.descripcion as tienda_descripcion, 
        t.subdominio, t.activa as tienda_activa, t.logo_url,
        t.color_primario, t.color_secundario, t.instagram, t.tiktok
       FROM comerciantes c
       LEFT JOIN tiendas t ON c.id = t.comerciante_id
       WHERE c.id = $1 AND c.plataforma = $2`,
      [id, PLATAFORMA],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "No encontrado" });
    }

    const stats = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM productos WHERE comerciante_id = $1 AND activo = true) as productos,
        (SELECT COUNT(*) FROM pedidos WHERE comerciante_id = $1) as pedidos,
        (SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE comerciante_id = $1 AND estado IN ('confirmado', 'preparando', 'enviado', 'entregado')) as ventas,
        (SELECT COUNT(*) FROM categorias WHERE comerciante_id = $1 AND activa = true) as categorias`,
      [id],
    );

    res.json({
      success: true,
      data: { ...result.rows[0], stats: stats.rows[0] },
    });
  } catch (error) {
    console.error("Error obteniendo comerciante:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

router.put("/comerciantes/:id", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, whatsapp, plan, pais, rubro } = req.body;

    const result = await pool.query(
      `UPDATE comerciantes 
       SET nombre = $1, email = $2, whatsapp = $3, plan = $4, pais = $5, rubro = $6
       WHERE id = $7 AND plataforma = $8
       RETURNING *`,
      [nombre, email, whatsapp, plan || "gratis", pais, rubro, id, PLATAFORMA],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "No encontrado" });
    }

    await pool.query(
      "UPDATE tiendas SET nombre = $1 WHERE comerciante_id = $2",
      [nombre, id],
    );

    res.json({
      success: true,
      message: "Comerciante actualizado",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error actualizando comerciante:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

router.put("/comerciantes/:id/toggle", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const current = await pool.query(
      "SELECT activo, nombre FROM comerciantes WHERE id = $1 AND plataforma = $2",
      [id, PLATAFORMA],
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, message: "No encontrado" });
    }

    const nuevoEstado = !current.rows[0].activo;

    await pool.query("UPDATE comerciantes SET activo = $1 WHERE id = $2", [
      nuevoEstado,
      id,
    ]);

    await pool.query(
      "UPDATE tiendas SET activa = $1 WHERE comerciante_id = $2",
      [nuevoEstado, id],
    );

    res.json({
      success: true,
      message: `${current.rows[0].nombre} ${nuevoEstado ? "activado" : "desactivado"}`,
      activo: nuevoEstado,
    });
  } catch (error) {
    console.error("Error toggling comerciante:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

router.put(
  "/comerciantes/:id/reset-password",
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { new_password } = req.body;

      if (!new_password || new_password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "La contraseña debe tener al menos 6 caracteres",
        });
      }

      const hashedPassword = await bcrypt.hash(new_password, 10);

      const result = await pool.query(
        "UPDATE comerciantes SET password_hash = $1 WHERE id = $2 AND plataforma = $3 RETURNING nombre",
        [hashedPassword, id, PLATAFORMA],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "No encontrado" });
      }

      res.json({
        success: true,
        message: `Contraseña reseteada para ${result.rows[0].nombre}`,
      });
    } catch (error) {
      console.error("Error reseteando contraseña:", error);
      res.status(500).json({ success: false, message: "Error interno" });
    }
  },
);

router.delete("/comerciantes/:id", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const check = await pool.query(
      "SELECT nombre FROM comerciantes WHERE id = $1 AND plataforma = $2",
      [id, PLATAFORMA],
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: "No encontrado" });
    }

    const nombre = check.rows[0].nombre;

    await pool.query(
      "DELETE FROM detalle_pedidos WHERE pedido_id IN (SELECT id FROM pedidos WHERE comerciante_id = $1)",
      [id],
    );
    await pool.query("DELETE FROM pedidos WHERE comerciante_id = $1", [id]);
    await pool.query(
      "DELETE FROM producto_imagenes WHERE producto_id IN (SELECT id FROM productos WHERE comerciante_id = $1)",
      [id],
    );
    await pool.query("DELETE FROM productos WHERE comerciante_id = $1", [id]);
    await pool.query("DELETE FROM categorias WHERE comerciante_id = $1", [id]);
    await pool.query("DELETE FROM tiendas WHERE comerciante_id = $1", [id]);
    await pool.query("DELETE FROM comerciantes WHERE id = $1", [id]);

    res.json({
      success: true,
      message: `Cuenta "${nombre}" eliminada completamente`,
    });
  } catch (error) {
    console.error("Error eliminando comerciante:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

module.exports = router;
