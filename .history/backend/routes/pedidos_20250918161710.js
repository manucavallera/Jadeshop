const express = require("express");
const router = express.Router();
const db = require("../config/database");

// GET /api/pedidos - Obtener todos los pedidos
router.get("/", async (req, res) => {
  try {
    const { estado, fecha_desde, fecha_hasta } = req.query;

    let query = "SELECT * FROM pedidos WHERE 1=1";
    let params = [];
    let paramIndex = 1;

    // Filtro por estado
    if (estado) {
      query += ` AND estado = $${paramIndex}`;
      params.push(estado);
      paramIndex++;
    }

    // Filtro por fecha desde
    if (fecha_desde) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(fecha_desde);
      paramIndex++;
    }

    // Filtro por fecha hasta
    if (fecha_hasta) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(fecha_hasta);
      paramIndex++;
    }

    query += " ORDER BY created_at DESC";

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Error obteniendo pedidos:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo pedidos",
      error: error.message,
    });
  }
});

// GET /api/pedidos/:id - Obtener pedido por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query("SELECT * FROM pedidos WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pedido no encontrado",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error obteniendo pedido:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo pedido",
      error: error.message,
    });
  }
});

// POST /api/pedidos - Crear nuevo pedido
router.post("/", async (req, res) => {
  try {
    const {
      usuario_id,
      cliente_telefono,
      cliente_nombre,
      cliente_email,
      cliente_direccion,
      productos,
      subtotal,
      envio,
      total,
      metodo_pago,
      notas,
    } = req.body;

    // Validaciones básicas
    if (
      !cliente_telefono ||
      !cliente_nombre ||
      !productos ||
      !Array.isArray(productos) ||
      productos.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Datos obligatorios faltantes: teléfono, nombre y productos",
      });
    }

    if (!total || total <= 0) {
      return res.status(400).json({
        success: false,
        message: "Total debe ser mayor a 0",
      });
    }

    // Generar código único de pedido
    const codigoPedido = await generarCodigoPedido();

    // Verificar stock de productos antes de crear el pedido
    const stockVerification = await verificarStock(productos);
    if (!stockVerification.success) {
      return res.status(400).json({
        success: false,
        message: "Stock insuficiente",
        detalles: stockVerification.detalles,
      });
    }

    // Crear el pedido
    const result = await db.query(
      `INSERT INTO pedidos (
    codigo_pedido, usuario_id, cliente_telefono, cliente_nombre, cliente_email, cliente_direccion,
    productos, subtotal, envio, total, metodo_pago, notas, estado
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  RETURNING *`,
      [
        codigoPedido,
        usuario_id, // ← NUEVO
        cliente_telefono,
        cliente_nombre,
        cliente_email, // ← NUEVO
        cliente_direccion,
        JSON.stringify(productos),
        subtotal,
        envio,
        total,
        metodo_pago,
        notas,
        "pendiente",
      ]
    );

    const pedidoCreado = result.rows[0];
    // Actualizar stock de productos
    await actualizarStock(productos);

    // Enviar a N8N/Jade Bro (webhook)
    try {
      await enviarWebhookN8N(pedidoCreado);

      // Marcar como enviado a Jade Bro
      await db.query(
        "UPDATE pedidos SET enviado_jadebro = true WHERE id = $1",
        [pedidoCreado.id]
      );
    } catch (webhookError) {
      console.error("Error enviando webhook a N8N:", webhookError);
      // No fallar el pedido por error de webhook
    }

    res.status(201).json({
      success: true,
      message: "Pedido creado exitosamente",
      data: pedidoCreado,
    });
  } catch (error) {
    console.error("Error creando pedido:", error);
    res.status(500).json({
      success: false,
      message: "Error creando pedido",
      error: error.message,
    });
  }
});

// PUT /api/pedidos/:id - Actualizar estado del pedido
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, notas } = req.body;

    const estadosPermitidos = [
      "pendiente",
      "confirmado",
      "preparando",
      "enviado",
      "entregado",
      "cancelado",
    ];

    if (estado && !estadosPermitidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: "Estado no válido",
        estadosPermitidos,
      });
    }

    let query = "UPDATE pedidos SET ";
    let params = [];
    let updates = [];
    let paramIndex = 1;

    if (estado) {
      updates.push(`estado = $${paramIndex}`);
      params.push(estado);
      paramIndex++;
    }

    if (notas !== undefined) {
      updates.push(`notas = $${paramIndex}`);
      params.push(notas);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No hay datos para actualizar",
      });
    }

    updates.push("updated_at = NOW()");
    query += updates.join(", ");
    query += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pedido no encontrado",
      });
    }

    res.json({
      success: true,
      message: "Pedido actualizado exitosamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error actualizando pedido:", error);
    res.status(500).json({
      success: false,
      message: "Error actualizando pedido",
      error: error.message,
    });
  }
});

// DELETE /api/pedidos/:id - Cancelar pedido
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING *",
      ["cancelado", id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pedido no encontrado",
      });
    }

    res.json({
      success: true,
      message: "Pedido cancelado exitosamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error cancelando pedido:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelando pedido",
      error: error.message,
    });
  }
});

// Funciones auxiliares

// Generar código único de pedido
async function generarCodigoPedido() {
  const fecha = new Date();
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const día = String(fecha.getDate()).padStart(2, "0");

  let intento = 0;
  let codigo;

  do {
    intento++;
    const numeroAleatorio = Math.floor(Math.random() * 9999)
      .toString()
      .padStart(4, "0");
    codigo = `LC-${año}${mes}${día}-${numeroAleatorio}`;

    // Verificar si ya existe
    const result = await db.query(
      "SELECT id FROM pedidos WHERE codigo_pedido = $1",
      [codigo]
    );

    if (result.rows.length === 0) {
      break; // Código único encontrado
    }
  } while (intento < 10);

  if (intento >= 10) {
    throw new Error("No se pudo generar código único de pedido");
  }

  return codigo;
}

// Verificar stock disponible
async function verificarStock(productos) {
  try {
    const detalles = [];
    let todoDisponible = true;

    for (const item of productos) {
      const result = await db.query(
        "SELECT stock FROM productos WHERE id = $1",
        [item.id]
      );

      if (result.rows.length === 0) {
        todoDisponible = false;
        detalles.push({
          producto_id: item.id,
          nombre: item.nombre,
          problema: "Producto no encontrado",
        });
        continue;
      }

      const stockDisponible = result.rows[0].stock;
      if (stockDisponible < item.cantidad) {
        todoDisponible = false;
        detalles.push({
          producto_id: item.id,
          nombre: item.nombre,
          solicitado: item.cantidad,
          disponible: stockDisponible,
          problema: "Stock insuficiente",
        });
      }
    }

    return {
      success: todoDisponible,
      detalles: todoDisponible ? [] : detalles,
    };
  } catch (error) {
    console.error("Error verificando stock:", error);
    return {
      success: false,
      detalles: [{ problema: "Error verificando stock" }],
    };
  }
}

// Actualizar stock después de crear pedido
async function actualizarStock(productos) {
  try {
    for (const item of productos) {
      await db.query("UPDATE productos SET stock = stock - $1 WHERE id = $2", [
        item.cantidad,
        item.id,
      ]);
    }
  } catch (error) {
    console.error("Error actualizando stock:", error);
    throw error;
  }
}

// Enviar webhook a N8N para Jade Bro
async function enviarWebhookN8N(pedido) {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      console.log("N8N_WEBHOOK_URL no configurado, saltando webhook");
      return;
    }

    const payload = {
      evento: "nuevo_pedido",
      pedido: {
        id: pedido.id,
        codigo: pedido.codigo_pedido,
        cliente: {
          telefono: pedido.cliente_telefono,
          nombre: pedido.cliente_nombre,
          direccion: pedido.cliente_direccion,
        },
        productos: JSON.parse(pedido.productos),
        total: pedido.total,
        metodo_pago: pedido.metodo_pago,
        notas: pedido.notas,
        fecha: pedido.created_at,
      },
    };

    const fetch = (await import("node-fetch")).default;
    const response = await fetch(webhookUrl + "/nuevo-pedido", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Webhook failed: ${response.status} ${response.statusText}`
      );
    }

    console.log("✅ Webhook enviado exitosamente a N8N");
  } catch (error) {
    console.error("❌ Error enviando webhook:", error);
    throw error;
  }
}

module.exports = router;
