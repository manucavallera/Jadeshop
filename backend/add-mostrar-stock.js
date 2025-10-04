require("dotenv").config();
const pool = require("./config/database");

async function addMostrarStockColumn() {
  try {
    console.log("🔧 Agregando columna mostrar_stock a tabla productos...");

    // Agregar columna
    await pool.query(`
      ALTER TABLE productos 
      ADD COLUMN IF NOT EXISTS mostrar_stock BOOLEAN DEFAULT true;
    `);

    console.log("✅ Columna agregada correctamente");

    // Actualizar registros existentes
    const updateResult = await pool.query(`
      UPDATE productos 
      SET mostrar_stock = true 
      WHERE mostrar_stock IS NULL;
    `);

    console.log(`✅ ${updateResult.rowCount} registros actualizados`);

    // Verificar
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'productos' 
      AND column_name = 'mostrar_stock';
    `);

    if (verifyResult.rows.length > 0) {
      console.log("\n📋 Verificación:");
      console.log(`   - Columna: ${verifyResult.rows[0].column_name}`);
      console.log(`   - Tipo: ${verifyResult.rows[0].data_type}`);
      console.log(`   - Default: ${verifyResult.rows[0].column_default}`);
      console.log("\n✅ Migración completada exitosamente");
    } else {
      console.log("\n⚠️  No se pudo verificar la columna");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

addMostrarStockColumn();
