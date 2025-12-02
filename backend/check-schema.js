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

    // Columnas de comerciantes
    const comerciantesCols = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'comerciantes'
      ORDER BY ordinal_position;
    `);

    console.log("\n👤 COLUMNAS DE COMERCIANTES:");
    comerciantesCols.rows.forEach((c) =>
      console.log(`   - ${c.column_name} (${c.data_type})`)
    );

    // Columnas de tiendas
    const tiendasCols = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'tiendas'
      ORDER BY ordinal_position;
    `);

    console.log("\n🏪 COLUMNAS DE TIENDAS:");
    if (tiendasCols.rows.length > 0) {
      tiendasCols.rows.forEach((c) =>
        console.log(`   - ${c.column_name} (${c.data_type})`)
      );
    } else {
      console.log("   ⚠️  La tabla 'tiendas' no existe o está vacía");
    }

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

    // Verificar relación comerciantes-tiendas
    const relacion = await pool.query(`
      SELECT 
        c.id as comerciante_id,
        c.nombre as comerciante_nombre,
        t.id as tienda_id
      FROM comerciantes c
      LEFT JOIN tiendas t ON c.id = t.comerciante_id
      LIMIT 3;
    `);

    console.log("\n🔗 RELACIÓN COMERCIANTES-TIENDAS (sample):");
    if (relacion.rows.length > 0) {
      relacion.rows.forEach((r) =>
        console.log(
          `   - Comerciante ${r.comerciante_id} (${
            r.comerciante_nombre
          }) → Tienda ${r.tienda_id || "SIN TIENDA"}`
        )
      );
    } else {
      console.log("   ⚠️  No hay datos para mostrar");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkSchema();
