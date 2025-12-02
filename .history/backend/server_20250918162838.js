const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      },
    },
  })
);
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, "../")));

// Rutas básicas
app.get("/", (req, res) => {
  res.json({
    message: "Live Commerce API funcionando! 🚀",
    version: "1.0.0",
    status: "active",
  });
});

// Ruta de salud del servidor
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Rutas API
app.use("/api/productos", require("./routes/productos"));
app.use("/api/pedidos", require("./routes/pedidos"));
app.use("/api/webhooks", require("./routes/webhooks"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/comerciantes", require("./routes/comerciantes")); // NUEVA RUTA

// Ruta dinámica para tiendas - DEBE IR AL FINAL
app.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    // Verificar si el slug existe en la base de datos
    const pool = require("./config/database");
    const result = await pool.query(
      `
      SELECT c.*, t.* 
      FROM comerciantes c 
      JOIN tiendas t ON c.id = t.comerciante_id 
      WHERE c.slug = $1 AND c.activo = true AND t.activa = true
    `,
      [slug]
    );

    if (result.rows.length === 0) {
      // Si no existe, mostrar 404
      return res.status(404).sendFile(path.join(__dirname, "../404.html"));
    }

    const tienda = result.rows[0];

    // Servir la tienda personalizada
    res.sendFile(path.join(__dirname, "../tienda-dinamica.html"));
  } catch (error) {
    console.error("Error cargando tienda:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Ruta para obtener datos de la tienda por slug
app.get("/api/tienda/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const pool = require("./config/database");
    const result = await pool.query(
      `
      SELECT c.*, t.* 
      FROM comerciantes c 
      JOIN tiendas t ON c.id = t.comerciante_id 
      WHERE c.slug = $1 AND c.activo = true AND t.activa = true
    `,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tienda no encontrada" });
    }

    const tienda = result.rows[0];

    res.json({
      success: true,
      data: {
        nombre: tienda.nombre,
        descripcion: tienda.descripcion,
        logo_url: tienda.logo_url,
        color_primario: tienda.color_primario,
        color_secundario: tienda.color_secundario,
        whatsapp: tienda.whatsapp,
        instagram: tienda.instagram,
        tiktok: tienda.tiktok,
        comerciante_id: tienda.comerciante_id,
      },
    });
  } catch (error) {
    console.error("Error obteniendo datos de tienda:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Middleware para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    path: req.originalUrl,
  });
});

// Middleware para manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Error interno del servidor",
    message:
      process.env.NODE_ENV === "development" ? err.message : "Algo salió mal",
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor funcionando en puerto ${PORT}`);
  console.log(`📱 API disponible en: http://localhost:${PORT}`);
  console.log(`🌐 Frontend disponible en: http://localhost:${PORT}`);
});

module.exports = app;
