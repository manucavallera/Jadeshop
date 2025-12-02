require("dotenv").config();
const pool = require("./config/database");

async function deleteAllComerciantes() {
  try {
    console.log(
      "⚠️  ADVERTENCIA: Esto borrará TODOS los comerciantes y sus datos relacionados"
    );
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

    // Eliminar en orden para respetar foreign keys
    console.log("🗑️  Eliminando producto_imagenes...");
    await pool.query("DELETE FROM producto_imagenes");

    console.log("🗑️  Eliminando detalle_pedidos...");
    await pool.query("DELETE FROM detalle_pedidos");

    console.log("🗑️  Eliminando pedidos...");
    await pool.query("DELETE FROM pedidos");

    console.log("🗑️  Eliminando productos...");
    await pool.query("DELETE FROM productos");

    console.log("🗑️  Eliminando tiendas...");
    await pool.query("DELETE FROM tiendas");

    console.log("🗑️  Eliminando comerciantes...");
    await pool.query("DELETE FROM comerciantes");

    // Reiniciar secuencias
    console.log("🔄 Reiniciando contadores...");
    await pool.query("ALTER SEQUENCE comerciantes_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE productos_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE pedidos_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE tiendas_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE producto_imagenes_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE detalle_pedidos_id_seq RESTART WITH 1");

    console.log("");
    console.log("✅ Todos los datos eliminados");
    console.log("✅ Contadores reiniciados");
    console.log("");
    console.log("La base de datos está limpia y lista para nuevos registros");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

deleteAllComerciantes();
