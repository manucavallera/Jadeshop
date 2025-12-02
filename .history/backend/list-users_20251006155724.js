require("dotenv").config();
const pool = require("./config/database");

async function listUsers() {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.nombre,
        c.email,
        c.plan,
        c.slug,
        c.created_at,
        (SELECT COUNT(*) FROM productos WHERE comerciante_id = c.id) as total_productos
      FROM comerciantes c
      ORDER BY c.created_at DESC
    `);

    console.log("\n📊 USUARIOS REGISTRADOS:\n");
    result.rows.forEach((user) => {
      console.log(`ID: ${user.id}`);
      console.log(`Nombre: ${user.nombre}`);
      console.log(`Email: ${user.email}`);
      console.log(`Plan: ${user.plan || "No definido"}`);
      console.log(`Slug: ${user.slug}`);
      console.log(`Productos: ${user.total_productos}`);
      console.log(`Creado: ${new Date(user.created_at).toLocaleString()}`);
      console.log("-".repeat(50));
    });

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

listUsers();
