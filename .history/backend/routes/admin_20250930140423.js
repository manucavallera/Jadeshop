const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// ===================
// MIDDLEWARE DE AUTENTICACIÓN TEMPORAL
// ===================

const cloudinary = require("../config/cloudinary");
const multer = require("multer");

// Configurar multer para memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten imágenes"), false);
    }
  },
});
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
      "SELECT SUM(total) FROM pedidos WHERE estado IN ('confirmado', 'preparando', 'enviado', 'entregado') AND comerciante_id = $1",
      [comerciante_id]
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

    // Ventas por día del comerciante - SOLO pedidos confirmados o entregados
    const ventasPorDia = await pool.query(
      `
  SELECT DATE(created_at) as fecha, SUM(total) as ventas
  FROM pedidos 
  WHERE estado IN ('confirmado', 'preparando', 'enviado', 'entregado')
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
    const {
      nombre,
      descripcion,
      descripcion_larga,
      precio,
      precio_rebajado,
      stock,
      categoria,
      imagen_url,
      categoria_id,
      tiktok_video_url,
    } = req.body;

    // AGREGAR ESTA VALIDACIÓN
    // Verificar límite de productos para plan gratis
    const userPlan = await pool.query(
      "SELECT plan FROM comerciantes WHERE id = $1",
      [comerciante_id]
    );

    if (userPlan.rows[0].plan === "gratis") {
      const countResult = await pool.query(
        "SELECT COUNT(*) FROM productos WHERE comerciante_id = $1",
        [comerciante_id]
      );

      if (parseInt(countResult.rows[0].count) >= 10) {
        return res.status(403).json({
          error: "Límite alcanzado",
          message:
            "El plan gratuito permite hasta 10 productos. Actualiza tu plan para agregar más productos.",
        });
      }
    }
    const result = await pool.query(
      "INSERT INTO productos (comerciante_id, nombre, descripcion, descripcion_larga, precio, precio_rebajado, stock, categoria, categoria_id, imagen_url, tiktok_video_url, activo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true) RETURNING *",
      [
        comerciante_id,
        nombre,
        descripcion,
        descripcion_larga,
        precio,
        precio_rebajado,
        stock,
        categoria,
        categoria_id,
        imagen_url,
        tiktok_video_url,
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
    const {
      nombre,
      descripcion,
      descripcion_larga,
      precio,
      precio_rebajado,
      stock,
      categoria,
      categoria_id,
      imagen_url,
      tiktok_video_url,
    } = req.body;

    const result = await pool.query(
      "UPDATE productos SET nombre=$1, descripcion=$2, descripcion_larga=$3, precio=$4, precio_rebajado=$5, stock=$6, categoria=$7, categoria_id=$8, imagen_url=$9, tiktok_video_url=$10, updated_at=NOW() WHERE id=$11 AND comerciante_id=$12 RETURNING *",
      [
        nombre,
        descripcion,
        descripcion_larga,
        precio,
        precio_rebajado,
        stock,
        categoria,
        categoria_id,
        imagen_url,
        tiktok_video_url, // $10 ✅
        id, // $11 ✅
        comerciante_id, // $12 ✅
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
// DELETE /api/admin/productos/:id - Eliminar producto
router.delete("/productos/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { comerciante_id } = req;

    const result = await pool.query(
      "DELETE FROM productos WHERE id = $1 AND comerciante_id = $2 RETURNING *",
      [id, comerciante_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Producto no encontrado o no pertenece a este comerciante",
      });
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

// GET /api/admin/pedidos?comerciante_id=X - Obtener pedidos del comerciante
router.get("/pedidos", requireAuth, async (req, res) => {
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

// POST /api/admin/pedidos - Crear nuevo pedido
router.post("/pedidos", requireAuth, async (req, res) => {
  try {
    const { comerciante_id } = req;
    const {
      productos,
      total,
      estado,
      cliente_nombre,
      cliente_email,
      cliente_whatsapp,
    } = req.body;

    // Generar código único de pedido
    const fecha = new Date();
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const día = String(fecha.getDate()).padStart(2, "0");
    const numeroAleatorio = Math.floor(Math.random() * 9999)
      .toString()
      .padStart(4, "0");
    const codigoPedido = `LC-${año}${mes}${día}-${numeroAleatorio}`;

    // Crear el pedido principal
    const result = await pool.query(
      `INSERT INTO pedidos (comerciante_id, codigo_pedido, cliente_telefono, productos, subtotal, total, estado, cliente_nombre, cliente_email, cliente_whatsapp, created_at, updated_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING id`,
      [
        comerciante_id, // $1
        codigoPedido, // $2
        cliente_whatsapp || "", // $3
        JSON.stringify(productos), // $4
        total, // $5 (subtotal)
        total, // $6 (total)
        estado, // $7
        cliente_nombre, // $8
        cliente_email, // $9
        cliente_whatsapp, // $10
      ]
    );
    const pedidoId = result.rows[0].id;

    // Insertar productos del pedido en detalle_pedidos
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
      message: "Pedido creado correctamente",
    });
  } catch (error) {
    console.error("Error creando pedido:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /api/admin/pedidos/:id/estado - Actualizar estado del pedido
router.put("/pedidos/:id/estado", requireAuth, async (req, res) => {
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

router.get("/tienda-config", requireAuth, async (req, res) => {
  try {
    const { comerciante_id } = req;

    const result = await pool.query(
      `SELECT c.nombre, c.slug, t.whatsapp, t.nombre as tienda_nombre
       FROM comerciantes c 
       LEFT JOIN tiendas t ON c.id = t.comerciante_id 
       WHERE c.id = $1`,
      [comerciante_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Comerciante no encontrado" });
    }

    const data = result.rows[0];

    res.json({
      nombre: data.tienda_nombre || data.nombre,
      whatsapp: data.whatsapp || "",
      slug: data.slug,
    });
  } catch (error) {
    console.error("Error obteniendo configuración:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /api/admin/tienda-config - Actualizar configuración
router.put("/tienda-config", requireAuth, async (req, res) => {
  try {
    const { comerciante_id } = req;
    const { nombre, whatsapp } = req.body;

    // Validaciones básicas
    if (!nombre || !whatsapp) {
      return res.status(400).json({
        error: "Nombre y WhatsApp son requeridos",
      });
    }

    // Validar formato de WhatsApp (solo números y +)
    const whatsappClean = whatsapp.replace(/[^\d+]/g, "");
    if (whatsappClean.length < 8) {
      return res.status(400).json({
        error: "Número de WhatsApp no válido",
      });
    }

    // Actualizar tienda
    const tiendaResult = await pool.query(
      "UPDATE tiendas SET nombre = $1, whatsapp = $2, updated_at = NOW() WHERE comerciante_id = $3 RETURNING *",
      [nombre, whatsappClean, comerciante_id]
    );

    if (tiendaResult.rows.length === 0) {
      return res.status(404).json({ error: "Tienda no encontrada" });
    }

    // También actualizar nombre del comerciante para consistencia
    await pool.query("UPDATE comerciantes SET nombre = $1 WHERE id = $2", [
      nombre,
      comerciante_id,
    ]);

    // Actualizar sesión con el nuevo nombre
    req.session.comerciante_nombre = nombre;

    res.json({
      success: true,
      message: "Configuración actualizada correctamente",
      data: {
        nombre: nombre,
        whatsapp: whatsappClean,
      },
    });
  } catch (error) {
    console.error("Error actualizando configuración:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/admin/upload-imagen - Subir imagen a Cloudinary
router.post(
  "/upload-imagen",
  requireAuth,
  upload.single("imagen"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: "No se encontró archivo de imagen" });
      }

      // Subir a Cloudinary usando buffer
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder: `live-commerce/productos/${req.comerciante_id}`,
              transformation: [
                { width: 800, height: 800, crop: "limit" },
                { quality: "auto" },
                { fetch_format: "auto" },
              ],
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          )
          .end(req.file.buffer);
      });

      res.json({
        success: true,
        imagen_url: result.secure_url,
        public_id: result.public_id,
      });
    } catch (error) {
      console.error("Error subiendo imagen:", error);
      res.status(500).json({ error: "Error subiendo imagen" });
    }
  }
);

// GESTIÓN DE CATEGORÍAS

// GET /api/admin/categorias - Listar categorías del comerciante
router.get("/categorias", requireAuth, async (req, res) => {
  try {
    const { comerciante_id } = req;

    const result = await pool.query(
      `SELECT c.*, COUNT(p.id) as productos_count 
       FROM categorias c 
       LEFT JOIN productos p ON c.id = p.categoria_id 
       WHERE c.comerciante_id = $1 AND c.activa = true
       GROUP BY c.id 
       ORDER BY c.created_at DESC`,
      [comerciante_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error obteniendo categorías:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/admin/categorias - Crear categoría
router.post("/categorias", requireAuth, async (req, res) => {
  try {
    const { comerciante_id } = req;
    const { nombre, descripcion } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: "Nombre es requerido" });
    }

    const result = await pool.query(
      "INSERT INTO categorias (nombre, descripcion, comerciante_id) VALUES ($1, $2, $3) RETURNING *",
      [nombre.trim(), descripcion?.trim(), comerciante_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res
        .status(400)
        .json({ error: "Ya existe una categoría con ese nombre" });
    }
    console.error("Error creando categoría:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /api/admin/categorias/:id - Actualizar categoría
router.put("/categorias/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { comerciante_id } = req;
    const { nombre, descripcion } = req.body;

    const result = await pool.query(
      "UPDATE categorias SET nombre=$1, descripcion=$2 WHERE id=$3 AND comerciante_id=$4 RETURNING *",
      [nombre.trim(), descripcion?.trim(), id, comerciante_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error actualizando categoría:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// DELETE /api/admin/categorias/:id - Eliminar categoría
router.delete("/categorias/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { comerciante_id } = req;

    const checkProducts = await pool.query(
      "SELECT COUNT(*) FROM productos WHERE categoria_id = $1",
      [id]
    );

    if (parseInt(checkProducts.rows[0].count) > 0) {
      return res.status(400).json({
        error: "No se puede eliminar, tiene productos asignados",
      });
    }

    const result = await pool.query(
      "DELETE FROM categorias WHERE id = $1 AND comerciante_id = $2 RETURNING *",
      [id, comerciante_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    res.json({ message: "Categoría eliminada correctamente" });
  } catch (error) {
    console.error("Error eliminando categoría:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Endpoint temporal para verificar vinculación
router.get("/verificar-productos-categorias", requireAuth, async (req, res) => {
  try {
    const { comerciante_id } = req;

    const productos = await pool.query(
      `SELECT id, nombre, categoria, categoria_id 
       FROM productos 
       WHERE comerciante_id = $1 
       ORDER BY id`,
      [comerciante_id]
    );

    const categorias = await pool.query(
      `SELECT id, nombre 
       FROM categorias 
       WHERE comerciante_id = $1 
       ORDER BY id`,
      [comerciante_id]
    );

    res.json({
      productos: productos.rows,
      categorias: categorias.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para re-vincular productos con categorías
router.post("/re-vincular-categorias", requireAuth, async (req, res) => {
  try {
    const { comerciante_id } = req;

    const result = await pool.query(`
      UPDATE productos 
      SET categoria_id = c.id 
      FROM categorias c 
      WHERE productos.categoria = c.nombre 
      AND productos.comerciante_id = c.comerciante_id 
      AND productos.categoria_id IS NULL
      RETURNING productos.id, productos.nombre, productos.categoria_id
    `);

    res.json({
      success: true,
      productos_vinculados: result.rowCount,
      productos: result.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/migrar-precio-rebajado", requireAuth, async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE productos 
      ADD COLUMN IF NOT EXISTS precio_rebajado DECIMAL(10,2) DEFAULT NULL
    `);

    res.json({
      success: true,
      message: "Columna precio_rebajado agregada correctamente",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/migrar-descripciones", requireAuth, async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE productos 
      ADD COLUMN IF NOT EXISTS descripcion_larga TEXT DEFAULT NULL
    `);

    res.json({
      success: true,
      message: "Columna descripcion_larga agregada correctamente",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/migrar-tiktok", requireAuth, async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE productos 
      ADD COLUMN IF NOT EXISTS tiktok_video_url TEXT DEFAULT NULL
    `);

    res.json({
      success: true,
      message: "Columna tiktok_video_url agregada correctamente",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
