// backend/migrations/add_product_images.js
require("dotenv").config();
const { query } = require("../config/database");

async function migrate() {
  try {
    console.log("🔄 Creando tabla producto_imagenes...");

    // Crear tabla para múltiples imágenes
    await query(`
      CREATE TABLE IF NOT EXISTS producto_imagenes (
        id SERIAL PRIMARY KEY,
        producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
        imagen_url TEXT NOT NULL,
        orden INTEGER DEFAULT 0,
        es_principal BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        
        -- Índices para mejor performance
        CONSTRAINT fk_producto
          FOREIGN KEY (producto_id) 
          REFERENCES productos(id)
          ON DELETE CASCADE
      );
      
      -- Crear índices
      CREATE INDEX IF NOT EXISTS idx_producto_imagenes_producto_id 
        ON producto_imagenes(producto_id);
      
      CREATE INDEX IF NOT EXISTS idx_producto_imagenes_orden 
        ON producto_imagenes(producto_id, orden);
    `);

    console.log("✅ Tabla producto_imagenes creada");

    // Migrar imágenes existentes a la nueva tabla
    console.log("🔄 Migrando imágenes existentes...");

    await query(`
      INSERT INTO producto_imagenes (producto_id, imagen_url, orden, es_principal)
      SELECT 
        id as producto_id,
        imagen_url,
        0 as orden,
        true as es_principal
      FROM productos
      WHERE imagen_url IS NOT NULL 
        AND imagen_url != ''
        AND NOT EXISTS (
          SELECT 1 FROM producto_imagenes 
          WHERE producto_imagenes.producto_id = productos.id
        );
    `);

    console.log("✅ Imágenes existentes migradas");

    // Agregar columna para tracking (opcional)
    await query(`
      ALTER TABLE productos 
      ADD COLUMN IF NOT EXISTS usa_galeria BOOLEAN DEFAULT false;
      
      -- Marcar productos que ya tienen imágenes en la galería
      UPDATE productos
      SET usa_galeria = true
      WHERE id IN (SELECT DISTINCT producto_id FROM producto_imagenes);
    `);

    console.log("✅ Migración completada exitosamente");

    // Mostrar estadísticas
    const stats = await query(`
      SELECT 
        COUNT(DISTINCT producto_id) as productos_con_imagenes,
        COUNT(*) as total_imagenes
      FROM producto_imagenes;
    `);

    console.log("\n📊 Estadísticas:");
    console.log(
      `   - Productos con imágenes: ${stats.rows[0].productos_con_imagenes}`
    );
    console.log(`   - Total de imágenes: ${stats.rows[0].total_imagenes}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error en migración:", error);
    process.exit(1);
  }
}

migrate();
