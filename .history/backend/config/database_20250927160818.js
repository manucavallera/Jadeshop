const { Pool } = require("pg");

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("DB_HOST:", process.env.DB_HOST);

// Configuración de conexión a PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "jadeshop_final",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Función para ejecutar queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log("Query ejecutada:", { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error("Error en query:", error);
    throw error;
  }
};

// Función para obtener cliente del pool (transacciones)
const getClient = () => {
  return pool.connect();
};

// Test de conexión
const testConnection = async () => {
  try {
    const result = await query("SELECT NOW() as now");
    console.log("✅ Conexión a PostgreSQL exitosa:", result.rows[0].now);
    return true;
  } catch (error) {
    console.error("❌ Error conectando a PostgreSQL:", error.message);
    return false;
  }
};

// Inicializar conexión al importar el módulo
testConnection();

module.exports = {
  query,
  getClient,
  pool,
  testConnection,
};
