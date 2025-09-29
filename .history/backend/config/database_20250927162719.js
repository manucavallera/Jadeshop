const { Pool } = require("pg");

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
console.log("DB_HOST:", process.env.DB_HOST);

// Configuración optimizada para Render
const pool = new Pool({
  // Usar DATABASE_URL si existe, sino variables individuales
  connectionString: process.env.DATABASE_URL,
  host: !process.env.DATABASE_URL ? process.env.DB_HOST : undefined,
  port: !process.env.DATABASE_URL ? process.env.DB_PORT || 5432 : undefined,
  database: !process.env.DATABASE_URL
    ? process.env.DB_NAME || "jadeshop_final"
    : undefined,
  user: !process.env.DATABASE_URL
    ? process.env.DB_USER || "postgres"
    : undefined,
  password: !process.env.DATABASE_URL
    ? String(process.env.DB_PASSWORD || "")
    : undefined,

  // SSL siempre activo para Render
  ssl: { rejectUnauthorized: false },

  // Configuración optimizada para conexiones remotas
  max: 5, // Reducir pool para desarrollo
  idleTimeoutMillis: 60000, // 60 segundos
  connectionTimeoutMillis: 15000, // 15 segundos para conexión inicial
  query_timeout: 30000, // 30 segundos para queries
  statement_timeout: 30000, // 30 segundos para statements

  // Configuraciones adicionales para estabilidad
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Función para ejecutar queries con timeout personalizado
const query = async (text, params = [], options = {}) => {
  const start = Date.now();
  const timeout = options.timeout || 30000;

  try {
    // Crear una promesa con timeout
    const queryPromise = pool.query(text, params);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Query timeout")), timeout);
    });

    const res = await Promise.race([queryPromise, timeoutPromise]);
    const duration = Date.now() - start;
    console.log("Query ejecutada:", {
      text: text.substring(0, 50) + "...",
      duration,
      rows: res.rowCount,
    });
    return res;
  } catch (error) {
    console.error("Error en query:", error.message);
    throw error;
  }
};

// Función para obtener cliente del pool (transacciones)
const getClient = async () => {
  try {
    return await pool.connect();
  } catch (error) {
    console.error("Error obteniendo cliente:", error.message);
    throw error;
  }
};

// Test de conexión con reintentos
const testConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔄 Intento de conexión ${i + 1}/${retries}...`);

      // Query simple con timeout corto
      const result = await query(
        "SELECT NOW() as now, version() as version",
        [],
        { timeout: 10000 }
      );

      console.log("✅ Conexión a PostgreSQL exitosa:", result.rows[0].now);
      console.log(
        "📊 Versión PostgreSQL:",
        result.rows[0].version.split(" ")[0]
      );
      return true;
    } catch (error) {
      console.error(`❌ Intento ${i + 1} falló:`, error.message);

      if (i === retries - 1) {
        console.error("❌ Error final de conexión:", {
          message: error.message,
          code: error.code,
          hint: "Verifica las credenciales de Render y la conectividad de red",
        });
        return false;
      }

      // Esperar antes del siguiente intento (backoff exponencial)
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.log(`⏳ Reintentando en ${delay / 1000} segundos...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Función para cerrar el pool limpiamente
const closePool = async () => {
  try {
    await pool.end();
    console.log("🔴 Pool de conexiones cerrado");
  } catch (error) {
    console.error("Error cerrando pool:", error.message);
  }
};

// Manejo de señales para cerrar limpiamente
process.on("SIGINT", async () => {
  console.log("🛑 Cerrando aplicación...");
  await closePool();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("🛑 Terminando aplicación...");
  await closePool();
  process.exit(0);
});

// Inicializar conexión al importar el módulo (no bloqueante)
testConnection().catch((error) => {
  console.error(
    "❌ Conexión inicial falló, pero la aplicación continuará:",
    error.message
  );
});

module.exports = {
  query,
  getClient,
  pool,
  testConnection,
  closePool,
};
