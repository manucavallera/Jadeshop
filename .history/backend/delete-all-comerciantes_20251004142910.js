require("dotenv").config();
const pool = require("./config/database");

async function deleteAllComerciantes() {
  try {
    console.log(
      "⚠️  ADVERTENCIA: Esto borrará TODOS los comerciantes y sus datos relacionados"
    );
    console.log("   - Productos");
    console.log("   - Imágenes de productos");
    console.log("   - Pedidos");
    console.log("   - Tiendas");
    console.log("");

    // Contar registros antes
    const countComerciantes = await pool.query(
      "SELECT COUNT(*) FROM comerciantes"
    );
    const countProductos = await pool.query("SELECT COUNT(*) FROM productos");
    const countPedidos = await pool.query("SELECT COUNT(*) FROM pedidos");

    console.log(`📊 Registros actuales:`);
    console.log(`   - Comerciantes: ${countComerciantes.rows[0].count}`);
    console.log(`   - Productos: ${countProductos.rows[0].count}`);
    console.log(`   - Pedidos: ${countPedidos.rows[0].count}`);
    console.log("");

    // Eliminar todos los comerciantes (CASCADE eliminará todo lo relacionado)
    await pool.query("DELETE FROM comerciantes");

    // Reiniciar secuencias
    await pool.query("ALTER SEQUENCE comerciantes_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE productos_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE pedidos_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE tiendas_id_seq RESTART WITH 1");

    console.log("✅ Todos los comerciantes eliminados");
    console.log("✅ Contadores reiniciados");
    console.log("");
    console.log("La base de datos está limpia y lista para nuevos registros");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

deleteAllComerciantes();
