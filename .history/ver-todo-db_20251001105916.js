require("dotenv").config();
const { query } = require("./backend/config/database");

async function verTodo() {
  try {
    console.log("Conectando a base de datos...\n");

    // Ver todas las tablas
    const tablas = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log("=== TABLAS EN LA BASE DE DATOS ===");
    tablas.rows.forEach((t) => console.log(`- ${t.table_name}`));

    // Para cada tabla, mostrar estructura y datos
    for (const tabla of tablas.rows) {
      const nombreTabla = tabla.table_name;

      console.log(
        `\n\n========== TABLA: ${nombreTabla.toUpperCase()} ==========`
      );

      // Columnas
      const columnas = await query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = '${nombreTabla}'
        ORDER BY ordinal_position;
      `);

      console.log("\nCOLUMNAS:");
      columnas.rows.forEach((col) => {
        console.log(
          `  ${col.column_name} | ${col.data_type} | ${
            col.is_nullable === "YES" ? "NULL" : "NOT NULL"
          }`
        );
      });

      // Contar registros
      const count = await query(`SELECT COUNT(*) FROM ${nombreTabla}`);
      console.log(`\nTOTAL DE REGISTROS: ${count.rows[0].count}`);

      // Mostrar primeros 3 registros
      const datos = await query(`SELECT * FROM ${nombreTabla} LIMIT 3`);
      if (datos.rows.length > 0) {
        console.log("\nPRIMEROS 3 REGISTROS:");
        console.table(datos.rows);
      }
    }

    console.log("\n✅ Consulta completada");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

verTodo();
