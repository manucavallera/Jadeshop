const { query } = require("../config/database");

async function migrate() {
  try {
    console.log("🔄 Agregando columnas a comerciantes...");

    await query(`
      ALTER TABLE comerciantes 
      ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20),
      ADD COLUMN IF NOT EXISTS pais VARCHAR(100),
      ADD COLUMN IF NOT EXISTS rubro VARCHAR(100)
    `);

    console.log("✅ Columnas agregadas exitosamente");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en migración:", error);
    process.exit(1);
  }
}

migrate();
