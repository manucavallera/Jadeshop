require("dotenv").config();
const pool = require("./config/database");

async function fixStoreNames() {
  try {
    console.log("Corrigiendo nombres de tiendas...");

    // Sincronizar nombres de tiendas con nombres de comerciantes
    const result = await pool.query(`
      UPDATE tiendas 
      SET nombre = comerciantes.nombre
      FROM comerciantes
      WHERE tiendas.comerciante_id = comerciantes.id
      RETURNING tiendas.id, tiendas.nombre, tiendas.subdominio
    `);

    console.log("\n✅ Nombres corregidos:");
    result.rows.forEach((row) => {
      console.log(`  - ${row.subdominio}: ${row.nombre}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

fixStoreNames();
