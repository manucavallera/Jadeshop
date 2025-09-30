// REEMPLAZA el archivo server.js con esta versión corregida:

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const session = require("express-session");
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
        scriptSrcAttr: ["'unsafe-inline'"],
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

app.use(
  session({
    secret: "live-commerce-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// Ruta principal (landing page)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../index.html"));
});

// Ruta de estado del API
app.get("/api/status", (req, res) => {
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

// 🔧 TODAS LAS RUTAS API DEBEN IR ANTES DE /:slug
app.use("/api/productos", require("./routes/productos"));
app.use("/api/pedidos", require("./routes/pedidos"));
app.use("/api/webhooks", require("./routes/webhooks"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/comerciantes", require("./routes/comerciantes"));
app.use("/api/auth", require("./routes/auth"));

// 🗑️ ELIMINAR esta ruta duplicada - ya existe en /api/comerciantes/:slug
// ❌ COMENTAR O ELIMINAR ESTAS LÍNEAS (90-110):
/*
app.get("/api/tienda/:slug", async (req, res) => {
  // ... código duplicado
});
*/

// 🔧 MEJORAR: Ruta dinámica para tiendas - DEBE IR AL FINAL
app.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    // 🔧 Agregar headers para evitar cache
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    // Verificar si el slug existe en la base de datos
    const pool = require("./config/database");
    const result = await pool.query(
      `SELECT c.*, t.* 
       FROM comerciantes c 
       JOIN tiendas t ON c.id = t.comerciante_id 
       WHERE t.subdominio = $1 AND c.activo = true AND t.activa = true`,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).sendFile(path.join(__dirname, "../404.html"));
    }

    // 🔧 Log para debug
    console.log(
      `Sirviendo tienda: ${slug} para comerciante ID: ${result.rows[0].comerciante_id}`
    );

    // Servir la tienda personalizada
    res.sendFile(path.join(__dirname, "../tienda-dinamica.html"));
  } catch (error) {
    console.error("Error cargando tienda:", error);
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
  console.log(`🌍 Frontend disponible en: http://localhost:${PORT}`);
});

module.exports = app;
