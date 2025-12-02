const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const bcrypt = require("bcrypt"); // AGREGAR ESTA LÍNEA

// GET /api/comerciantes/:slug - Obtener datos de la tienda
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      `
      SELECT 
        c.id as comerciante_id,
        c.nombre as comerciante_nombre,
        c.slug,
        c.whatsapp,
        t.nombre,
        t.descripcion,
        t.logo_url,
        t.color_primario,
        t.color_secundario,
        t.instagram,
        t.tiktok,
        t.subdominio
      FROM comerciantes c 
      JOIN tiendas t ON c.id = t.comerciante_id 
      WHERE t.subdominio = $1 AND c.activo = true AND t.activa = true
    `,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tienda no encontrada",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error obteniendo tienda:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

// GET /api/comerciantes/:slug/productos - Obtener productos de la tienda
router.get("/:slug/productos", async (req, res) => {
  try {
    const { slug } = req.params;

    // Primero obtener el comerciante_id por subdominio
    const tiendaResult = await pool.query(
      `SELECT c.id FROM comerciantes c 
       JOIN tiendas t ON c.id = t.comerciante_id 
       WHERE t.subdominio = $1 AND c.activo = true AND t.activa = true`,
      [slug]
    );

    if (tiendaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tienda no encontrada",
      });
    }

    const comercianteId = tiendaResult.rows[0].id;

    // Obtener productos del comerciante
    const productosResult = await pool.query(
      "SELECT * FROM productos WHERE comerciante_id = $1 ORDER BY created_at DESC",
      [comercianteId]
    );

    res.json({
      success: true,
      data: productosResult.rows,
    });
  } catch (error) {
    console.error("Error obteniendo productos:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

// GET /api/comerciantes/:slug/productos/:id - Obtener producto específico
router.get("/:slug/productos/:id", async (req, res) => {
  try {
    const { slug, id } = req.params;

    // Primero obtener el comerciante_id por subdominio
    const tiendaResult = await pool.query(
      `SELECT c.id FROM comerciantes c 
       JOIN tiendas t ON c.id = t.comerciante_id 
       WHERE t.subdominio = $1 AND c.activo = true AND t.activa = true`,
      [slug]
    );

    if (tiendaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tienda no encontrada",
      });
    }

    const comercianteId = tiendaResult.rows[0].id;

    // Obtener producto específico
    const productoResult = await pool.query(
      `SELECT * FROM productos 
       WHERE id = $1 AND comerciante_id = $2 AND activo = true`,
      [id, comercianteId]
    );

    if (productoResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado",
      });
    }

    res.json({
      success: true,
      data: productoResult.rows[0],
    });
  } catch (error) {
    console.error("Error obteniendo producto:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

// GET /api/comerciantes/check-slug/:slug - Verificar disponibilidad de slug
router.get("/check-slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    // Verificar en tabla comerciantes por slug
    const comercianteResult = await pool.query(
      "SELECT id FROM comerciantes WHERE slug = $1",
      [slug]
    );

    // Verificar en tabla tiendas por subdominio
    const tiendaResult = await pool.query(
      "SELECT id FROM tiendas WHERE subdominio = $1",
      [slug]
    );

    const available =
      comercianteResult.rows.length === 0 && tiendaResult.rows.length === 0;

    res.json({
      available: available,
      slug: slug,
    });
  } catch (error) {
    console.error("Error verificando slug:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

// POST /api/comerciantes - Crear nuevo comerciante (registro)
router.post("/", async (req, res) => {
  try {
    const {
      email,
      nombre,
      telefono,
      slug,
      tienda_nombre,
      whatsapp,
      rubro,
      pais,
      password, // AGREGAR ESTA LÍNEA
    } = req.body;

    // Validaciones básicas
    if (!email || !nombre || !slug || !tienda_nombre || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Faltan datos obligatorios: email, nombre, slug, tienda_nombre, password",
      });
    }

    // Validar contraseña
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "La contraseña debe tener al menos 6 caracteres",
      });
    }

    // Verificar que el slug no exista en comerciantes
    const slugExists = await pool.query(
      "SELECT id FROM comerciantes WHERE slug = $1",
      [slug]
    );

    if (slugExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "El nombre de tienda ya está en uso",
      });
    }

    // Verificar que el subdominio no exista en tiendas
    const subdominioExists = await pool.query(
      "SELECT id FROM tiendas WHERE subdominio = $1",
      [slug]
    );

    if (subdominioExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "El nombre de tienda ya está en uso",
      });
    }

    // Verificar que el email no exista
    const emailExists = await pool.query(
      "SELECT id FROM comerciantes WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    if (emailExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "El email ya está registrado",
      });
    }

    // Hash de la contraseña
    const password_hash = await bcrypt.hash(password, 10);

    // Crear comerciante CON password_hash
    const comercianteResult = await pool.query(
      "INSERT INTO comerciantes (email, nombre, telefono, slug, password_hash, pais, activo) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *",
      [email.toLowerCase().trim(), nombre, telefono, slug, password_hash, pais]
    );

    const comerciante = comercianteResult.rows[0];

    // Crear tienda
    const tiendaResult = await pool.query(
      "INSERT INTO tiendas (comerciante_id, nombre, whatsapp, subdominio, descripcion, activa) VALUES ($1, $2, $3, $4, $5, true) RETURNING *",
      [
        comerciante.id,
        tienda_nombre,
        whatsapp,
        slug,
        `Tienda de ${rubro || "productos"} - ${pais || ""}`,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Tienda creada exitosamente",
      data: {
        comerciante: {
          id: comerciante.id,
          nombre: comerciante.nombre,
          email: comerciante.email,
          slug: comerciante.slug,
        },
        tienda: tiendaResult.rows[0],
        url: `${req.protocol}://${req.get("host")}/${slug}`,
      },
    });
  } catch (error) {
    console.error("Error creando comerciante:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

// POST /:slug/pedidos - Crear pedido desde la tienda (público)
router.post("/:slug/pedidos", async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      productos,
      total,
      cliente_nombre,
      cliente_email,
      cliente_whatsapp,
    } = req.body;

    // Obtener comerciante_id del slug
    const comerciante = await pool.query(
      "SELECT id FROM comerciantes WHERE slug = $1",
      [slug]
    );

    if (comerciante.rows.length === 0) {
      return res.status(404).json({ error: "Tienda no encontrada" });
    }

    const comerciante_id = comerciante.rows[0].id;

    // Generar código de pedido
    const fecha = new Date();
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const día = String(fecha.getDate()).padStart(2, "0");
    const numeroAleatorio = Math.floor(Math.random() * 9999)
      .toString()
      .padStart(4, "0");
    const codigoPedido = `LC-${año}${mes}${día}-${numeroAleatorio}`;

    // Crear pedido
    const result = await pool.query(
      `INSERT INTO pedidos (comerciante_id, codigo_pedido, cliente_telefono, productos, subtotal, total, estado, cliente_nombre, cliente_email, cliente_whatsapp, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING id`,
      [
        comerciante_id,
        codigoPedido,
        cliente_whatsapp || "",
        JSON.stringify(productos),
        total,
        total,
        "pendiente",
        cliente_nombre || "Cliente WhatsApp",
        cliente_email || "",
        cliente_whatsapp || "",
      ]
    );

    const pedidoId = result.rows[0].id;

    // Insertar detalles
    for (const producto of productos) {
      await pool.query(
        `INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4)`,
        [
          pedidoId,
          producto.producto_id,
          producto.cantidad,
          producto.precio_unitario,
        ]
      );
    }

    res.status(201).json({
      success: true,
      pedido_id: pedidoId,
      codigo_pedido: codigoPedido,
    });
  } catch (error) {
    console.error("Error creando pedido:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
