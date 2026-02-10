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
      [slug],
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
// GET /api/comerciantes/:slug/productos - Obtener productos de la tienda
router.get("/:slug/productos", async (req, res) => {
  try {
    const { slug } = req.params;

    // Primero obtener el comerciante_id por subdominio
    const tiendaResult = await pool.query(
      `SELECT c.id FROM comerciantes c 
       JOIN tiendas t ON c.id = t.comerciante_id 
       WHERE t.subdominio = $1 AND c.activo = true AND t.activa = true`,
      [slug],
    );

    if (tiendaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tienda no encontrada",
      });
    }

    const comercianteId = tiendaResult.rows[0].id;

    // ✅ NUEVO: Obtener categorías con jerarquía
    const categoriasResult = await pool.query(
      `SELECT c.id, c.nombre, c.padre_id, cp.nombre as padre_nombre
       FROM categorias c
       LEFT JOIN categorias cp ON c.padre_id = cp.id
       WHERE c.comerciante_id = $1 AND c.activa = true
       ORDER BY c.padre_id NULLS FIRST, c.nombre ASC`,
      [comercianteId],
    );

    // ✅ NUEVO: Obtener productos CON imagen principal de galería Y categoria info
    const productosResult = await pool.query(
      `SELECT p.*, 
              c.nombre as categoria,
              c.padre_id as categoria_padre_id,
              COALESCE(
                (SELECT imagen_url 
                 FROM producto_imagenes 
                 WHERE producto_id = p.id 
                 AND es_principal = true 
                 LIMIT 1),
                p.imagen_url
              ) as imagen_url
       FROM productos p 
       LEFT JOIN categorias c ON p.categoria_id = c.id
       WHERE p.comerciante_id = $1 AND p.activo = true
       ORDER BY p.created_at DESC`,
      [comercianteId],
    );

    res.json({
      success: true,
      data: productosResult.rows,
      categorias: categoriasResult.rows,
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
      [slug],
    );

    if (tiendaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tienda no encontrada",
      });
    }

    const comercianteId = tiendaResult.rows[0].id;

    // ✅ NUEVO: Obtener producto con imagen principal de galería
    const productoResult = await pool.query(
      `SELECT p.*,
              COALESCE(
                (SELECT imagen_url 
                 FROM producto_imagenes 
                 WHERE producto_id = p.id 
                 AND es_principal = true 
                 LIMIT 1),
                p.imagen_url
              ) as imagen_url
       FROM productos p
       WHERE p.id = $1 AND p.comerciante_id = $2 AND p.activo = true`,
      [id, comercianteId],
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
      [slug],
    );

    // Verificar en tabla tiendas por subdominio
    const tiendaResult = await pool.query(
      "SELECT id FROM tiendas WHERE subdominio = $1",
      [slug],
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
      [slug],
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
      [slug],
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
      [email.toLowerCase().trim()],
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
      [email.toLowerCase().trim(), nombre, telefono, slug, password_hash, pais],
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
      ],
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

// GET /:slug/pedidos/buscar/:codigo - Buscar pedido por código
router.get("/:slug/pedidos/buscar/:codigo", async (req, res) => {
  try {
    const { slug, codigo } = req.params;

    const comerciante = await pool.query(
      "SELECT id FROM comerciantes WHERE slug = $1",
      [slug],
    );

    if (comerciante.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Tienda no encontrada" });
    }

    const comerciante_id = comerciante.rows[0].id;

    const result = await pool.query(
      `SELECT p.*,
              json_agg(json_build_object(
                'producto_id', dp.producto_id,
                'cantidad', dp.cantidad,
                'precio_unitario', dp.precio_unitario,
                'nombre', pr.nombre
              )) as detalle
       FROM pedidos p
       LEFT JOIN detalle_pedidos dp ON p.id = dp.pedido_id
       LEFT JOIN productos pr ON dp.producto_id = pr.id
       WHERE p.comerciante_id = $1
         AND (p.codigo_pedido ILIKE $2 OR p.id::text = $3)
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT 10`,
      [comerciante_id, `%${codigo}%`, codigo],
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Error buscando pedido:", error);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// GET /:slug/pedidos - Listar pedidos de la tienda
router.get("/:slug/pedidos", async (req, res) => {
  try {
    const { slug } = req.params;
    const { estado, page = 1, limit = 20 } = req.query;

    const comerciante = await pool.query(
      "SELECT id FROM comerciantes WHERE slug = $1",
      [slug],
    );

    if (comerciante.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Tienda no encontrada" });
    }

    const comerciante_id = comerciante.rows[0].id;
    const offset = (page - 1) * limit;

    let query = "SELECT * FROM pedidos WHERE comerciante_id = $1";
    let params = [comerciante_id];
    let paramIndex = 2;

    if (estado) {
      query += ` AND estado = $${paramIndex}`;
      params.push(estado);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM pedidos WHERE comerciante_id = $1${estado ? " AND estado = $2" : ""}`,
      estado ? [comerciante_id, estado] : [comerciante_id],
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
    });
  } catch (error) {
    console.error("Error listando pedidos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
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
      cliente_direccion,
    } = req.body;

    // Obtener comerciante_id del slug
    const comerciante = await pool.query(
      "SELECT id FROM comerciantes WHERE slug = $1",
      [slug],
    );

    if (comerciante.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Tienda no encontrada" });
    }

    const comerciante_id = comerciante.rows[0].id;

    // ✅ VERIFICAR STOCK ANTES DE CREAR EL PEDIDO
    const stockProblems = [];
    for (const item of productos) {
      const stockResult = await pool.query(
        "SELECT id, nombre, stock FROM productos WHERE id = $1 AND comerciante_id = $2 AND activo = true",
        [item.producto_id, comerciante_id],
      );

      if (stockResult.rows.length === 0) {
        stockProblems.push({
          producto_id: item.producto_id,
          problema: "Producto no encontrado",
        });
        continue;
      }

      const producto = stockResult.rows[0];
      if (producto.stock < item.cantidad) {
        stockProblems.push({
          producto_id: item.producto_id,
          nombre: producto.nombre,
          solicitado: item.cantidad,
          disponible: producto.stock,
          problema: "Stock insuficiente",
        });
      }
    }

    if (stockProblems.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Stock insuficiente",
        detalles: stockProblems,
      });
    }

    // Generar código de pedido único
    let codigoPedido;
    let intentos = 0;
    do {
      intentos++;
      const fecha = new Date();
      const anio = fecha.getFullYear();
      const mes = String(fecha.getMonth() + 1).padStart(2, "0");
      const dia = String(fecha.getDate()).padStart(2, "0");
      const rand = Math.floor(Math.random() * 9999)
        .toString()
        .padStart(4, "0");
      codigoPedido = `LC-${anio}${mes}${dia}-${rand}`;

      const exists = await pool.query(
        "SELECT id FROM pedidos WHERE codigo_pedido = $1",
        [codigoPedido],
      );
      if (exists.rows.length === 0) break;
    } while (intentos < 10);

    if (intentos >= 10) {
      return res
        .status(500)
        .json({ success: false, error: "No se pudo generar código único" });
    }

    // Crear pedido
    const result = await pool.query(
      `INSERT INTO pedidos (comerciante_id, codigo_pedido, cliente_telefono, productos, subtotal, total, estado, cliente_nombre, cliente_email, cliente_whatsapp, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING id, codigo_pedido`,
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
      ],
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
        ],
      );
    }

    // ✅ DESCONTAR STOCK
    for (const item of productos) {
      await pool.query(
        "UPDATE productos SET stock = stock - $1 WHERE id = $2 AND stock >= $1",
        [item.cantidad, item.producto_id],
      );
    }

    res.status(201).json({
      success: true,
      pedido_id: pedidoId,
      codigo_pedido: codigoPedido,
    });
  } catch (error) {
    console.error("Error creando pedido:", error);
    res
      .status(500)
      .json({ success: false, error: "Error interno del servidor" });
  }
});

// Agregar ANTES del último module.exports
router.get("/:slug/productos/:id/imagenes", async (req, res) => {
  try {
    const { slug, id } = req.params;

    const tiendaResult = await pool.query(
      `SELECT c.id FROM comerciantes c 
       JOIN tiendas t ON c.id = t.comerciante_id 
       WHERE t.subdominio = $1`,
      [slug],
    );

    if (tiendaResult.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Tienda no encontrada" });
    }

    const comercianteId = tiendaResult.rows[0].id;

    const productoCheck = await pool.query(
      "SELECT id FROM productos WHERE id = $1 AND comerciante_id = $2",
      [id, comercianteId],
    );

    if (productoCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Producto no encontrado" });
    }

    const imagenesResult = await pool.query(
      `SELECT * FROM producto_imagenes 
       WHERE producto_id = $1 
       ORDER BY es_principal DESC, orden ASC`,
      [id],
    );

    res.json({ success: true, data: imagenesResult.rows });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

module.exports = router;
