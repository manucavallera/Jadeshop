require("dotenv").config();
const pool = require("../config/database");

async function migrate() {
  try {
    console.log("Agregando columna mercadopago_subscription_id...");

    await pool.query(`
      ALTER TABLE comerciantes 
      ADD COLUMN IF NOT EXISTS mercadopago_subscription_id VARCHAR(255)
    `);

    console.log("✅ Migración completada");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en migración:", error.message);
    process.exit(1);
  }
}

migrate();
