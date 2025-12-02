require("dotenv").config();
const pool = require("./config/database");

async function checkSchema() {
  try {
    // Tablas principales
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log("📋 TABLAS:");
    tables.rows.forEach((t) => console.log(`   - ${t.table_name}`));

    // Columnas de productos
    const productoCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'productos'
      ORDER BY ordinal_position;
    `);

    console.log("\n📦 COLUMNAS DE PRODUCTOS:");
    productoCols.rows.forEach((c) =>
      console.log(`   - ${c.column_name} (${c.data_type})`)
    );

    // Columnas de producto_imagenes
    const imagenesCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'producto_imagenes'
      ORDER BY ordinal_position;
    `);

    console.log("\n🖼️  COLUMNAS DE PRODUCTO_IMAGENES:");
    imagenesCols.rows.forEach((c) =>
      console.log(`   - ${c.column_name} (${c.data_type})`)
    );

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkSchema();
