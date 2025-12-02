require("dotenv").config();
const pool = require("./config/database");

async function changePlan(userId, newPlan) {
  try {
    const result = await pool.query(
      "UPDATE comerciantes SET plan = $1 WHERE id = $2 RETURNING id, nombre, email, plan",
      [newPlan, userId]
    );

    if (result.rows.length === 0) {
      console.log("Usuario no encontrado");
      process.exit(1);
    }

    const user = result.rows[0];
    console.log("\n✅ Plan actualizado:");
    console.log(`   Usuario: ${user.nombre}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nuevo plan: ${user.plan}`);
    console.log("");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

const userId = parseInt(process.argv[2]);
const newPlan = process.argv[3];

if (!userId || !newPlan) {
  console.log("Uso: node backend/change-plan.js [ID] [plan]");
  console.log("Planes disponibles: gratis, pro, jadebro, jadebro-max");
  console.log("\nEjemplo: node backend/change-plan.js 1 pro");
  process.exit(1);
}

changePlan(userId, newPlan);
