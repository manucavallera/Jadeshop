const express = require("express");
const router = express.Router();
const db = require("../config/database");

// POST /api/webhooks/pedido-actualizado - Webhook desde N8N cuando Jade Bro procesa un pedido
router.post("/pedido-actualizado", async (req, res) => {
  try {
    const {
      pedido_id,
      codigo_pedido,
      estado_jadebro,
      respuesta_cliente,
      notas_jadebro,
      cliente_confirmado,
    } = req.body;

    console.log("📨 Webhook recibido desde N8N:", req.body);

    // Validar datos requeridos
    if (!pedido_id && !codigo_pedido) {
      return res.status(400).json({
        success: false,
        message: "Se requiere pedido_id o codigo_pedido",
      });
    }

    // Buscar el pedido
    let pedido;
    if (pedido_id) {
      const result = await db.query("SELECT * FROM pedidos WHERE id = $1", [
        pedido_id,
      ]);
      pedido = result.rows[0];
    } else {
      const result = await db.query(
        "SELECT * FROM pedidos WHERE codigo_pedido = $1",
        [codigo_pedido]
      );
      pedido = result.rows[0];
    }

    if (!pedido) {
      return res.status(404).json({
        success: false,
        message: "Pedido no encontrado",
      });
    }

    // Actualizar el pedido con la información de Jade Bro
    let nuevoEstado = pedido.estado;

    // Mapear estados de Jade Bro a nuestros estados
    if (estado_jadebro) {
      switch (estado_jadebro.toLowerCase()) {
        case "contactado":
        case "mensaje_enviado":
          nuevoEstado = "pendiente";
          break;
        case "confirmado":
        case "cliente_confirmo":
          nuevoEstado = "confirmado";
          break;
        case "rechazado":
        case "cancelado":
          nuevoEstado = "cancelado";
          break;
        default:
          nuevoEstado = pedido.estado; // Mantener estado actual
      }
    }

    // Si el cliente confirmó explícitamente
    if (cliente_confirmado === true) {
      nuevoEstado = "confirmado";
    }

    // Preparar respuesta de Jade Bro para guardar
    const jadeBroResponse = {
      timestamp: new Date().toISOString(),
      estado_jadebro: estado_jadebro,
      respuesta_cliente: respuesta_cliente,
      notas: notas_jadebro,
      cliente_confirmado: cliente_confirmado,
    };

    // Actualizar pedido en la base de datos
    const updateResult = await db.query(
      `UPDATE pedidos 
             SET estado = $1, 
                 jadebro_response = COALESCE(jadebro_response, '[]'::jsonb) || $2::jsonb,
                 notas = CASE 
                     WHEN $3 IS NOT NULL THEN 
                         CASE 
                             WHEN notas IS NULL OR notas = '' THEN $3
                             ELSE notas || E'\n--- Jade Bro ---\n' || $3
                         END
                     ELSE notas
                 END,
                 updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
      [nuevoEstado, JSON.stringify(jadeBroResponse), notas_jadebro, pedido.id]
    );

    const pedidoActualizado = updateResult.rows[0];

    console.log("✅ Pedido actualizado:", {
      id: pedidoActualizado.id,
      codigo: pedidoActualizado.codigo_pedido,
      estado_anterior: pedido.estado,
      estado_nuevo: nuevoEstado,
    });

    res.json({
      success: true,
      message: "Pedido actualizado exitosamente",
      data: {
        pedido_id: pedidoActualizado.id,
        codigo_pedido: pedidoActualizado.codigo_pedido,
        estado_anterior: pedido.estado,
        estado_nuevo: nuevoEstado,
        actualizado_en: pedidoActualizado.updated_at,
      },
    });
  } catch (error) {
    console.error("❌ Error procesando webhook:", error);
    res.status(500).json({
      success: false,
      message: "Error procesando webhook",
      error: error.message,
    });
  }
});

// POST /api/webhooks/test - Webhook de prueba
router.post("/test", (req, res) => {
  console.log("🧪 Webhook de prueba recibido:", {
    headers: req.headers,
    body: req.body,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: "Webhook de prueba recibido correctamente",
    data: {
      recibido_en: new Date().toISOString(),
      datos_recibidos: req.body,
    },
  });
});

// GET /api/webhooks/status - Estado de webhooks
router.get("/status", async (req, res) => {
  try {
    // Obtener estadísticas de pedidos y webhooks
    const stats = await db.query(`
            SELECT 
                COUNT(*) as total_pedidos,
                COUNT(*) FILTER (WHERE enviado_jadebro = true) as enviados_jadebro,
                COUNT(*) FILTER (WHERE jadebro_response IS NOT NULL) as con_respuesta_jadebro,
                COUNT(*) FILTER (WHERE estado = 'confirmado') as confirmados,
                COUNT(*) FILTER (WHERE estado = 'cancelado') as cancelados
            FROM pedidos 
            WHERE created_at >= NOW() - INTERVAL '24 hours'
        `);

    const estadisticas = stats.rows[0];

    res.json({
      success: true,
      data: {
        servidor: {
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        },
        estadisticas_24h: {
          total_pedidos: parseInt(estadisticas.total_pedidos),
          enviados_jadebro: parseInt(estadisticas.enviados_jadebro),
          con_respuesta_jadebro: parseInt(estadisticas.con_respuesta_jadebro),
          confirmados: parseInt(estadisticas.confirmados),
          cancelados: parseInt(estadisticas.cancelados),
        },
        configuracion: {
          n8n_webhook_url: process.env.N8N_WEBHOOK_URL
            ? "Configurado"
            : "No configurado",
          jadebro_phone: process.env.JADEBRO_PHONE
            ? "Configurado"
            : "No configurado",
        },
      },
    });
  } catch (error) {
    console.error("Error obteniendo estado de webhooks:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo estadísticas",
      error: error.message,
    });
  }
});

// POST /api/webhooks/reenviar/:pedido_id - Reenviar pedido a N8N/Jade Bro
router.post("/reenviar/:pedido_id", async (req, res) => {
  try {
    const { pedido_id } = req.params;

    // Obtener el pedido
    const result = await db.query("SELECT * FROM pedidos WHERE id = $1", [
      pedido_id,
    ]);
    const pedido = result.rows[0];

    if (!pedido) {
      return res.status(404).json({
        success: false,
        message: "Pedido no encontrado",
      });
    }

    // Reenviar webhook
    try {
      await enviarWebhookN8N(pedido);

      // Marcar como reenviado
      await db.query(
        "UPDATE pedidos SET enviado_jadebro = true, updated_at = NOW() WHERE id = $1",
        [pedido_id]
      );

      res.json({
        success: true,
        message: "Pedido reenviado exitosamente a Jade Bro",
        data: {
          pedido_id: pedido.id,
          codigo_pedido: pedido.codigo_pedido,
        },
      });
    } catch (webhookError) {
      console.error("Error reenviando webhook:", webhookError);
      res.status(500).json({
        success: false,
        message: "Error reenviando pedido a Jade Bro",
        error: webhookError.message,
      });
    }
  } catch (error) {
    console.error("Error reenviando pedido:", error);
    res.status(500).json({
      success: false,
      message: "Error procesando reenvío",
      error: error.message,
    });
  }
});

// Función auxiliar para enviar webhook (reutilizada desde pedidos.js)
async function enviarWebhookN8N(pedido) {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      throw new Error("N8N_WEBHOOK_URL no configurado");
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
        productos:
          typeof pedido.productos === "string"
            ? JSON.parse(pedido.productos)
            : pedido.productos,
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
      timeout: 10000, // 10 segundos timeout
    });

    if (!response.ok) {
      throw new Error(
        `Webhook failed: ${response.status} ${response.statusText}`
      );
    }

    const responseData = await response.text();
    console.log("✅ Webhook enviado exitosamente a N8N:", responseData);

    return responseData;
  } catch (error) {
    console.error("❌ Error enviando webhook:", error);
    throw error;
  }
}

module.exports = router;
