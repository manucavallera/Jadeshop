// Admin Panel JavaScript - Multi-tenant
class AdminPanel {
  constructor() {
    this.currentSection = "dashboard";
    this.editingProduct = null;
    this.charts = {
      ventas: null,
      productos: null,
    };
    this.currentProductImage = null; // NUEVA LÍNEA

    this.currentUser = null;

    this.init();
  }

  async init() {
    await this.checkSession(); // AGREGAR: verificar sesión primero
    this.setupEventListeners();
  }

  // Verificar sesión al cargar
  async checkSession() {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        this.currentUser = data.comerciante;
        this.showAdminPanel();
      } else {
        this.showLoginForm();
      }
    } catch (error) {
      this.showLoginForm();
    }
  }

  // Mostrar formulario de login
  showLoginForm() {
    document.getElementById("loginContainer").classList.remove("d-none");
    document.getElementById("adminContainer").classList.add("d-none");
  }

  // Mostrar panel admin
  showAdminPanel() {
    document.getElementById("loginContainer").classList.add("d-none");
    document.getElementById("adminContainer").classList.remove("d-none");
    document.getElementById(
      "userInfo"
    ).textContent = `Bienvenido, ${this.currentUser.nombre}`;

    // 🔍 DEBUG: Verificar todo paso a paso
    console.log("=== DEBUG: Ver Tienda Link ===");
    console.log("1. Usuario actual:", this.currentUser);
    console.log("2. Slug del usuario:", this.currentUser?.slug);

    const verTiendaLink = document.getElementById("verTiendaLink");
    console.log("3. Elemento encontrado:", verTiendaLink);

    if (verTiendaLink) {
      console.log("4. Href actual:", verTiendaLink.href);

      if (this.currentUser && this.currentUser.slug) {
        const newHref = `/${this.currentUser.slug}`;
        verTiendaLink.href = newHref;
        console.log("5. ✅ Nuevo href asignado:", newHref);
        console.log(
          "6. Verificación href después de asignar:",
          verTiendaLink.href
        );
      } else {
        console.log("5. ❌ No hay slug disponible");
        console.log("   - currentUser existe:", !!this.currentUser);
        console.log("   - slug existe:", this.currentUser?.slug);
      }
    } else {
      console.log("4. ❌ Elemento verTiendaLink no encontrado en el DOM");
    }

    // Cargar datos iniciales
    this.loadDashboard();
    this.loadProductos();
    this.loadPedidos();
  }

  setupEventListeners() {
    // Login form
    document.getElementById("loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Logout button
    document.getElementById("logoutBtn").addEventListener("click", (e) => {
      e.preventDefault();
      this.handleLogout();
    });
    // Navegación
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        if (e.target.dataset.section) {
          e.preventDefault();
          this.showSection(e.target.dataset.section);
        }
      });
    });

    // Mobile sidebar toggle
    const toggleBtn = document.getElementById("toggleSidebar");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        document.getElementById("sidebar").classList.toggle("show");
      });
    }

    // Formulario de producto
    document.getElementById("guardarProducto").addEventListener("click", () => {
      this.saveProduct();
    });

    // Modal reset
    document
      .getElementById("productoModal")
      .addEventListener("hidden.bs.modal", () => {
        this.resetProductForm();
      });

    document
      .getElementById("tiendaConfigForm")
      .addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveConfiguracion();
      });

    // Manejar cambio de imagen
    document
      .getElementById("productoImagenFile")
      .addEventListener("change", (e) => {
        this.handleImageChange(e);
      });

    // Event listeners para categorías
    document
      .getElementById("nuevaCategoriaForm")
      .addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveCategoria();
      });

    document
      .getElementById("guardarCategoriaEditBtn")
      .addEventListener("click", () => {
        this.saveEditCategoria();
      });

    document
      .getElementById("categoriasModal")
      .addEventListener("shown.bs.modal", () => {
        this.loadCategorias();
      });

    // Cargar categorías cuando se abre el modal de productos
    document
      .getElementById("productoModal")
      .addEventListener("shown.bs.modal", () => {
        this.loadCategorias();
      });
  }

  async handleLogin() {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    this.setLoginLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (result.success) {
        this.currentUser = result.comerciante;
        this.showAdminPanel();
      } else {
        this.showAlert(result.message, "danger");
      }
    } catch (error) {
      this.showAlert("Error de conexión", "danger");
    } finally {
      this.setLoginLoading(false);
    }
  }

  async handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      this.currentUser = null;
      this.showLoginForm();
    } catch (error) {
      console.error("Error en logout:", error);
    }
  }

  setLoginLoading(loading) {
    const btn = document.getElementById("loginBtn");
    const text = document.getElementById("loginBtnText");
    const spinner = document.getElementById("loginBtnSpinner");

    if (loading) {
      btn.disabled = true;
      text.classList.add("d-none");
      spinner.classList.remove("d-none");
    } else {
      btn.disabled = false;
      text.classList.remove("d-none");
      spinner.classList.add("d-none");
    }
  }

  showSection(section) {
    // Ocultar todas las secciones
    document.querySelectorAll(".content-section").forEach((sec) => {
      sec.classList.add("d-none");
    });

    // Mostrar sección seleccionada
    document.getElementById(`${section}-section`).classList.remove("d-none");

    // Actualizar navegación
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.remove("active");
    });
    document
      .querySelector(`[data-section="${section}"]`)
      .classList.add("active");

    this.currentSection = section;

    // Cargar datos según la sección
    switch (section) {
      case "dashboard":
        this.loadDashboard();
        break;
      case "productos":
        this.loadProductos();
        break;
      case "pedidos":
        this.loadPedidos();
        break;
      case "configuracion":
        this.loadConfiguracion();
        break;
    }
  }

  // ===================
  // DASHBOARD
  // ===================
  async loadDashboard() {
    try {
      const response = await fetch("/api/admin/dashboard");

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Actualizar stats con validación
      document.getElementById("totalPedidos").textContent =
        data.totalPedidos || 0;
      document.getElementById("totalVentas").textContent = `$${Number(
        data.totalVentas || 0
      ).toLocaleString()}`;
      document.getElementById("pedidosPendientes").textContent =
        data.pedidosPendientes || 0;
      document.getElementById("totalProductos").textContent =
        data.totalProductos || 0;

      // Crear gráficos con validación
      this.createVentasChart(data.ventasPorDia || []);
      this.createProductosChart(data.topProductos || []);
    } catch (error) {
      console.error("Error cargando dashboard:", error);
      this.showAlert("Error cargando el dashboard", "danger");

      // Mostrar valores por defecto
      document.getElementById("totalPedidos").textContent = "0";
      document.getElementById("totalVentas").textContent = "$0";
      document.getElementById("pedidosPendientes").textContent = "0";
      document.getElementById("totalProductos").textContent = "0";
    }
  }

  createVentasChart(data) {
    const ctx = document.getElementById("ventasChart").getContext("2d");

    if (this.charts.ventas) {
      this.charts.ventas.destroy();
    }

    // Validar que data sea un array
    if (!Array.isArray(data)) {
      data = [];
    }

    const labels = data.map((item) => {
      const fecha = new Date(item.fecha);
      return fecha.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
      });
    });

    const ventas = data.map((item) => Number(item.ventas) || 0);

    // Si no hay datos, mostrar datos de ejemplo
    if (labels.length === 0) {
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        labels.push(
          date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })
        );
        ventas.push(0);
      }
    }

    this.charts.ventas = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Ventas ($)",
            data: ventas,
            borderColor: "#3B82F6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return "$" + value.toLocaleString();
              },
            },
          },
        },
      },
    });
  }

  createProductosChart(data) {
    const ctx = document.getElementById("productosChart").getContext("2d");

    if (this.charts.productos) {
      this.charts.productos.destroy();
    }

    // Validar que data sea un array
    if (!Array.isArray(data)) {
      data = [];
    }

    const labels = data.map((item) => item.nombre);
    const cantidades = data.map((item) => Number(item.total_vendido));

    // Si no hay datos, mostrar mensaje
    if (labels.length === 0) {
      labels.push("Sin datos");
      cantidades.push(1);
    }

    this.charts.productos = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: cantidades,
            backgroundColor: [
              "#3B82F6",
              "#10B981",
              "#8B5CF6",
              "#F59E0B",
              "#EF4444",
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    });
  }

  // ===================
  // PRODUCTOS
  // ===================
  async loadProductos() {
    try {
      const response = await fetch("/api/admin/productos");
      const productos = await response.json();

      const tbody = document.getElementById("productosTableBody");

      if (!Array.isArray(productos) || productos.length === 0) {
        tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-4 text-muted">
                            No hay productos registrados
                        </td>
                    </tr>
                `;
        return;
      }

      tbody.innerHTML = productos
        .map(
          (producto) => `
                <tr>
                    <td>${producto.id}</td>
                    <td>
                        <img src="${
                          producto.imagen_url ||
                          "https://via.placeholder.com/50"
                        }" 
                             alt="${producto.nombre}" 
                             class="rounded" 
                             style="width: 50px; height: 50px; object-fit: cover;">
                    </td>
                    <td>${producto.nombre}</td>
                    <td><span class="badge bg-secondary">${
                      producto.categoria
                    }</span></td>
                    <td>
  ${
    producto.precio_rebajado
      ? `<div>
         <span style="text-decoration: line-through;" class="text-muted small d-block">$${Number(
           producto.precio
         ).toLocaleString()}</span>
         <span class="text-success fw-bold">$${Number(
           producto.precio_rebajado
         ).toLocaleString()}</span>
         <span class="badge bg-danger ms-1">OFERTA</span>
       </div>`
      : `$${Number(producto.precio).toLocaleString()}`
  }
</td>
                    <td>
                        <span class="badge ${
                          producto.stock > 10
                            ? "bg-success"
                            : producto.stock > 0
                            ? "bg-warning"
                            : "bg-danger"
                        }">
                            ${producto.stock}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="adminPanel.editProduct(${
                          producto.id
                        })">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="adminPanel.deleteProduct(${
                          producto.id
                        })">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `
        )
        .join("");
    } catch (error) {
      console.error("Error cargando productos:", error);
      this.showAlert("Error cargando productos", "danger");
    }
  }

  async saveProduct() {
    console.log("💾 DEBUG: Iniciando saveProduct()");
    console.log(
      "📝 Modo edición:",
      !!this.editingProduct,
      "ID:",
      this.editingProduct
    );
    console.log("🖼️ Imagen preservada en memoria:", this.currentProductImage);

    const form = document.getElementById("productoForm");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Usar imagen de variable de clase como fallback
    let imagen_url = this.currentProductImage;

    // Verificar si hay nueva imagen para subir
    const imagenFile = document.getElementById("productoImagenFile").files[0];
    console.log("📁 Archivo nuevo seleccionado:", !!imagenFile);

    // Si hay archivo nuevo, subirlo (sobrescribe la imagen existente)
    if (imagenFile) {
      console.log("⬆️ Subiendo nueva imagen...");
      this.showAlert("Subiendo nueva imagen...", "info");
      const nuevaImagen = await this.uploadImagen(imagenFile);

      if (nuevaImagen) {
        imagen_url = nuevaImagen;
        console.log("✅ Nueva imagen subida:", nuevaImagen);
      } else {
        console.log("❌ Error subiendo nueva imagen");
        return;
      }
    }

    // Si usuario modificó URL manualmente, usar esa
    const manualUrl = document.getElementById("productoImagen").value.trim();
    if (manualUrl && manualUrl !== this.currentProductImage) {
      imagen_url = manualUrl;
      console.log("🔧 Usuario modificó URL manualmente:", manualUrl);
    }

    console.log("🔄 Imagen final a usar:", imagen_url);

    const categoriaSelect = document.getElementById("productoCategoria");

    const productData = {
      nombre: document.getElementById("productoNombre").value.trim(),
      descripcion: document.getElementById("productoDescripcion").value.trim(),
      descripcion_larga: document
        .getElementById("productoDescripcionLarga")
        .value.trim(),
      precio: parseFloat(document.getElementById("productoPrecio").value),
      precio_rebajado: document.getElementById("productoPrecioRebajado").value
        ? parseFloat(document.getElementById("productoPrecioRebajado").value)
        : null,
      stock: parseInt(document.getElementById("productoStock").value),
      categoria: categoriaSelect.options[categoriaSelect.selectedIndex].text,
      categoria_id: parseInt(categoriaSelect.value),
      imagen_url: imagen_url || null,
      tiktok_video_url:
        document.getElementById("productoTiktokUrl").value.trim() || null,
    };
    console.log("📤 Datos a enviar:", productData);

    try {
      const url = this.editingProduct
        ? `/api/admin/productos/${this.editingProduct}`
        : "/api/admin/productos";

      const method = this.editingProduct ? "PUT" : "POST";

      console.log("🌐 Request:", method, url);

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productData),
      });

      console.log("📡 Response status:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Producto guardado:", result);

        const modal = bootstrap.Modal.getInstance(
          document.getElementById("productoModal")
        );
        modal.hide();

        this.showAlert(
          this.editingProduct
            ? "Producto actualizado correctamente"
            : "Producto creado correctamente",
          "success"
        );

        // Limpiar variable de imagen
        this.currentProductImage = null;

        this.loadProductos();
        this.loadDashboard();
      } else {
        const errorData = await response.json();
        console.log("❌ Error del servidor:", errorData);
        throw new Error(errorData.message || "Error al guardar producto");
      }
    } catch (error) {
      console.error("❌ Error guardando producto:", error);
      this.showAlert(
        "Error al guardar el producto: " + error.message,
        "danger"
      );
    }
  }

  async editProduct(id) {
    try {
      console.log("🔍 DEBUG: Iniciando edición del producto", id);

      const response = await fetch("/api/admin/productos");
      const productos = await response.json();
      const producto = productos.find((p) => p.id === id);

      if (!producto) {
        this.showAlert("Producto no encontrado", "danger");
        return;
      }

      console.log("📦 Producto encontrado:", producto);
      console.log("🖼️ Imagen URL del producto:", producto.imagen_url);

      // Llenar formulario con datos existentes (ORDEN CORRECTO)
      document.getElementById("productoNombre").value = producto.nombre;
      document.getElementById("productoDescripcion").value =
        producto.descripcion || "";
      document.getElementById("productoDescripcionLarga").value =
        producto.descripcion_larga || "";
      document.getElementById("productoTiktokUrl").value =
        producto.tiktok_video_url || "";
      document.getElementById("productoPrecio").value = producto.precio;
      document.getElementById("productoPrecioRebajado").value =
        producto.precio_rebajado || "";
      document.getElementById("productoStock").value = producto.stock;
      document.getElementById("productoCategoria").value = producto.categoria;

      // CRÍTICO: Guardar imagen en variable de clase
      this.currentProductImage = producto.imagen_url || null;
      console.log(
        "💾 Imagen guardada en variable de clase:",
        this.currentProductImage
      );

      // También llenar el campo para mostrar en UI
      document.getElementById("productoImagen").value =
        producto.imagen_url || "";

      // Si hay imagen existente, mostrar preview
      if (producto.imagen_url) {
        console.log("🖼️ Configurando preview para imagen existente");

        const previewContainer = document.getElementById(
          "imagenPreviewContainer"
        );

        if (previewContainer) {
          previewContainer.style.display = "block";
          previewContainer.innerHTML = `
          <div class="text-center mb-3">
            <img src="${producto.imagen_url}" alt="Imagen actual" class="img-thumbnail" style="max-width: 200px;">
            <div class="small text-success mt-2">
              <i class="fas fa-check-circle"></i> 
              Imagen preservada en memoria - Se mantendrá automáticamente
            </div>
          </div>
        `;
          console.log("✅ Preview configurado correctamente");
        }

        // Activar pestaña de URL automáticamente si hay imagen
        const urlTab = document.getElementById("url-tab");
        const uploadTab = document.getElementById("upload-tab");
        const urlPane = document.getElementById("url-pane");
        const uploadPane = document.getElementById("upload-pane");

        if (urlTab && uploadTab && urlPane && uploadPane) {
          urlTab.classList.add("active");
          urlPane.classList.add("show", "active");
          uploadTab.classList.remove("active");
          uploadPane.classList.remove("show", "active");
          console.log("✅ Pestaña URL activada automáticamente");
        }
      } else {
        this.currentProductImage = null;
      }

      // Cambiar título del modal
      document.getElementById("productoModalTitle").textContent =
        "Editar Producto";
      this.editingProduct = id;
      console.log("🏷️ editingProduct establecido a:", this.editingProduct);

      // Mostrar modal
      const modal = new bootstrap.Modal(
        document.getElementById("productoModal")
      );
      modal.show();

      console.log("🎯 Modal mostrado, editProduct() completado");
    } catch (error) {
      console.error("❌ Error cargando producto para editar:", error);
      this.showAlert("Error cargando el producto", "danger");
    }
  }

  async deleteProduct(id) {
    if (!confirm("¿Estás seguro de que quieres eliminar este producto?")) {
      return;
    }

    console.log("🗑️ DEBUG: Eliminando producto", id);

    try {
      const response = await fetch(`/api/admin/productos/${id}`, {
        method: "DELETE",
      });

      console.log("📡 Response status:", response.status);
      console.log("📡 Response ok:", response.ok);

      if (response.ok) {
        const result = await response.text(); // Cambiar a .text() para ver respuesta raw
        console.log("✅ Respuesta del servidor:", result);

        this.showAlert("Producto eliminado correctamente", "success");
        this.loadProductos();
        this.loadDashboard();
      } else {
        const errorText = await response.text();
        console.log("❌ Error del servidor:", errorText);
        throw new Error("Error al eliminar producto");
      }
    } catch (error) {
      console.error("❌ Error eliminando producto:", error);
      this.showAlert("Error al eliminar el producto", "danger");
    }
  }

  async loadCategorias() {
    try {
      const response = await fetch("/api/admin/categorias");
      if (!response.ok) throw new Error("Error cargando categorías");

      const categorias = await response.json();
      const tbody = document.getElementById("categoriasTableBody");

      if (!Array.isArray(categorias) || categorias.length === 0) {
        tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center py-3 text-muted">
            <i class="fas fa-inbox fa-2x mb-2 d-block"></i>
            No hay categorías creadas. ¡Crea tu primera categoría arriba!
          </td>
        </tr>
      `;
        return;
      }

      tbody.innerHTML = categorias
        .map(
          (cat) => `
      <tr>
        <td><strong>${cat.nombre}</strong></td>
        <td>${
          cat.descripcion || '<em class="text-muted">Sin descripción</em>'
        }</td>
        <td class="text-center">
          <span class="badge bg-info">${cat.productos_count || 0}</span>
        </td>
        <td class="text-center">
          <button 
            class="btn btn-sm btn-outline-primary me-1" 
            onclick="adminPanel.editCategoria(${cat.id}, '${cat.nombre.replace(
            /'/g,
            "\\'"
          )}', '${(cat.descripcion || "").replace(/'/g, "\\'")}')"
            title="Editar"
          >
            <i class="fas fa-edit"></i>
          </button>
          <button 
            class="btn btn-sm btn-outline-danger" 
            onclick="adminPanel.deleteCategoria(${cat.id})"
            ${
              parseInt(cat.productos_count) > 0
                ? 'disabled title="No se puede eliminar, tiene productos asignados"'
                : 'title="Eliminar"'
            }
          >
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `
        )
        .join("");

      this.updateCategoriasSelect(categorias);
    } catch (error) {
      console.error("Error cargando categorías:", error);
      this.showAlert("Error cargando categorías", "danger");
    }
  }

  updateCategoriasSelect(categorias) {
    const select = document.getElementById("productoCategoria");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Seleccionar categoría</option>';

    categorias.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat.nombre;
      option.textContent = cat.nombre;
      option.dataset.categoriaId = cat.id; // AGREGAR ESTO
      select.appendChild(option);
    });

    if (currentValue) select.value = currentValue;
  }

  async saveCategoria() {
    const nombre = document.getElementById("nombreCategoria").value.trim();
    const descripcion = document
      .getElementById("descripcionCategoria")
      .value.trim();

    if (!nombre) {
      this.showAlert("El nombre es requerido", "warning");
      return;
    }

    try {
      const response = await fetch("/api/admin/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, descripcion }),
      });

      const result = await response.json();

      if (response.ok) {
        this.showAlert("Categoría creada correctamente", "success");
        document.getElementById("nuevaCategoriaForm").reset();
        this.loadCategorias();
      } else {
        throw new Error(result.error || "Error al crear categoría");
      }
    } catch (error) {
      console.error("Error guardando categoría:", error);
      this.showAlert("Error: " + error.message, "danger");
    }
  }

  editCategoria(id, nombre, descripcion) {
    document.getElementById("editCategoriaId").value = id;
    document.getElementById("editNombreCategoria").value = nombre;
    document.getElementById("editDescripcionCategoria").value = descripcion;

    const modal = new bootstrap.Modal(
      document.getElementById("editarCategoriaModal")
    );
    modal.show();
  }

  async saveEditCategoria() {
    const id = document.getElementById("editCategoriaId").value;
    const nombre = document.getElementById("editNombreCategoria").value.trim();
    const descripcion = document
      .getElementById("editDescripcionCategoria")
      .value.trim();

    if (!nombre) {
      this.showAlert("El nombre es requerido", "warning");
      return;
    }

    try {
      const response = await fetch(`/api/admin/categorias/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, descripcion }),
      });

      if (response.ok) {
        this.showAlert("Categoría actualizada correctamente", "success");

        const modal = bootstrap.Modal.getInstance(
          document.getElementById("editarCategoriaModal")
        );
        modal.hide();

        this.loadCategorias();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Error al actualizar");
      }
    } catch (error) {
      console.error("Error actualizando categoría:", error);
      this.showAlert("Error: " + error.message, "danger");
    }
  }

  async deleteCategoria(id) {
    if (!confirm("¿Estás seguro de eliminar esta categoría?")) return;

    try {
      const response = await fetch(`/api/admin/categorias/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        this.showAlert("Categoría eliminada correctamente", "success");
        this.loadCategorias();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Error al eliminar");
      }
    } catch (error) {
      console.error("Error eliminando categoría:", error);
      this.showAlert("Error: " + error.message, "danger");
    }
  }
  resetProductForm() {
    document.getElementById("productoForm").reset();
    document.getElementById("productoModalTitle").textContent =
      "Nuevo Producto";

    // Limpiar preview de imagen
    const previewContainer = document.getElementById("imagenPreviewContainer");
    if (previewContainer) {
      previewContainer.style.display = "none";
    }

    // Limpiar campos de imagen
    document.getElementById("productoImagenFile").value = "";
    document.getElementById("productoImagen").value = "";

    document.getElementById("productoPrecio").value = "";
    document.getElementById("productoPrecioRebajado").value = "";

    document.getElementById("productoDescripcionLarga").value = "";
    document.getElementById("productoTiktokUrl").value = "";

    // NUEVO: Limpiar variable de imagen
    this.currentProductImage = null;

    this.editingProduct = null;
  }
  // ===================
  // PEDIDOS
  // ===================
  async loadPedidos() {
    try {
      const response = await fetch("/api/admin/pedidos");

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const pedidos = await response.json();

      const tbody = document.getElementById("pedidosTableBody");

      // Validar que pedidos sea un array
      if (!Array.isArray(pedidos) || pedidos.length === 0) {
        tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-4 text-muted">
                            No hay pedidos registrados
                        </td>
                    </tr>
                `;
        return;
      }

      tbody.innerHTML = pedidos
        .map(
          (pedido) => `
                <tr>
                    <td>#${pedido.id}</td>
                    <td>${pedido.cliente_nombre || "N/A"}</td>
                    <td>${pedido.cliente_email || "N/A"}</td>
                    <td>$${Number(pedido.total || 0).toLocaleString()}</td>
                    <td>
                        <select class="form-select form-select-sm" onchange="adminPanel.changeOrderStatus(${
                          pedido.id
                        }, this.value)">
                            <option value="pendiente" ${
                              pedido.estado === "pendiente" ? "selected" : ""
                            }>Pendiente</option>
                            <option value="confirmado" ${
                              pedido.estado === "confirmado" ? "selected" : ""
                            }>Confirmado</option>
                            <option value="preparando" ${
                              pedido.estado === "preparando" ? "selected" : ""
                            }>Preparando</option>
                            <option value="enviado" ${
                              pedido.estado === "enviado" ? "selected" : ""
                            }>Enviado</option>
                            <option value="entregado" ${
                              pedido.estado === "entregado" ? "selected" : ""
                            }>Entregado</option>
                            <option value="cancelado" ${
                              pedido.estado === "cancelado" ? "selected" : ""
                            }>Cancelado</option>
                        </select>
                    </td>
                    <td>${new Date(pedido.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-info" onclick="adminPanel.viewOrderDetails(${
                          pedido.id
                        })">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `
        )
        .join("");
    } catch (error) {
      console.error("Error cargando pedidos:", error);
      this.showAlert("Error cargando pedidos", "danger");

      // Mostrar mensaje de error en la tabla
      const tbody = document.getElementById("pedidosTableBody");
      tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-danger">
                        Error cargando pedidos. Por favor, inténtalo de nuevo.
                    </td>
                </tr>
            `;
    }
  }

  async changeOrderStatus(orderId, newStatus) {
    try {
      const response = await fetch(`/api/admin/pedidos/${orderId}/estado`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          estado: newStatus,
        }),
      });

      if (response.ok) {
        this.showAlert("Estado del pedido actualizado", "success");
      } else {
        throw new Error("Error al actualizar estado");
      }
    } catch (error) {
      console.error("Error actualizando estado:", error);
      this.showAlert("Error al actualizar el estado del pedido", "danger");
      this.loadPedidos(); // Recargar para restaurar el estado anterior
    }
  }

  async viewOrderDetails(orderId) {
    try {
      const response = await fetch("/api/admin/pedidos");
      const pedidos = await response.json();
      const pedido = pedidos.find((p) => p.id === orderId);

      if (!pedido) {
        this.showAlert("Pedido no encontrado", "danger");
        return;
      }

      // Crear modal con detalles del pedido (resto del código igual)
      // ... (mantener el código del modal igual)
    } catch (error) {
      console.error("Error cargando detalles del pedido:", error);
      this.showAlert("Error cargando los detalles del pedido", "danger");
    }
  }

  generateWhatsAppLink(orderId) {
    const message = `Hola! Te contacto desde Live Commerce sobre tu pedido #${orderId}. ¿En qué puedo ayudarte?`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  }

  // ===================
  // CONFIGURACIÓN DE TIENDA
  // ===================

  // Cargar configuración de la tienda
  async loadConfiguracion() {
    try {
      const response = await fetch("/api/admin/tienda-config");
      if (response.ok) {
        const data = await response.json();

        document.getElementById("tiendaNombreConfig").value = data.nombre || "";
        document.getElementById("whatsappConfig").value = data.whatsapp || "";
        document.getElementById("tiendaUrlPreview").textContent = `${
          window.location.origin
        }/${data.slug || "tu-slug"}`;
      } else {
        throw new Error("Error cargando configuración");
      }
    } catch (error) {
      console.error("Error cargando configuración:", error);
      this.showAlert("Error cargando configuración", "danger");
    }
  }

  // Guardar configuración
  async saveConfiguracion() {
    const form = document.getElementById("tiendaConfigForm");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const configData = {
      nombre: document.getElementById("tiendaNombreConfig").value.trim(),
      whatsapp: document.getElementById("whatsappConfig").value.trim(),
    };

    // Validación básica
    if (!configData.nombre || !configData.whatsapp) {
      this.showAlert("Todos los campos son requeridos", "warning");
      return;
    }

    // Validar WhatsApp (solo números)
    const whatsappClean = configData.whatsapp.replace(/[^\d+]/g, "");
    if (whatsappClean.length < 8) {
      this.showAlert("Número de WhatsApp no válido", "warning");
      return;
    }

    this.setConfigLoading(true);

    try {
      const response = await fetch("/api/admin/tienda-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(configData),
      });

      const result = await response.json();

      if (response.ok) {
        this.showAlert("Configuración guardada correctamente", "success");

        // Actualizar info del usuario en el sidebar
        this.currentUser.nombre = configData.nombre;
        document.getElementById(
          "userInfo"
        ).textContent = `Bienvenido, ${configData.nombre}`;
      } else {
        throw new Error(result.error || "Error al guardar");
      }
    } catch (error) {
      console.error("Error guardando configuración:", error);
      this.showAlert("Error al guardar la configuración", "danger");
    } finally {
      this.setConfigLoading(false);
    }
  }

  // Loading state para el botón de configuración
  setConfigLoading(loading) {
    const btn = document.getElementById("guardarConfigBtn");
    const text = document.getElementById("guardarBtnText");
    const spinner = document.getElementById("guardarBtnSpinner");

    if (loading) {
      btn.disabled = true;
      text.classList.add("d-none");
      spinner.classList.remove("d-none");
    } else {
      btn.disabled = false;
      text.classList.remove("d-none");
      spinner.classList.add("d-none");
    }
  }

  // ===================
  // SUBIDA DE IMÁGENES
  // ===================

  // Subir imagen a Cloudinary
  async uploadImagen(file) {
    const formData = new FormData();
    formData.append("imagen", file);

    try {
      const response = await fetch("/api/admin/upload-imagen", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Error subiendo imagen");
      }

      const result = await response.json();
      return result.imagen_url;
    } catch (error) {
      console.error("Error subiendo imagen:", error);
      this.showAlert("Error subiendo imagen", "danger");
      return null;
    }
  }

  // Manejar cambio de archivo de imagen
  handleImageChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      this.showAlert("La imagen debe ser menor a 5MB", "warning");
      event.target.value = "";
      return;
    }

    // Validar tipo de archivo
    if (!file.type.startsWith("image/")) {
      this.showAlert("Solo se permiten archivos de imagen", "warning");
      event.target.value = "";
      return;
    }

    // Mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById("imagenPreview");
      const previewContainer = document.getElementById(
        "imagenPreviewContainer"
      );

      preview.src = e.target.result;
      previewContainer.style.display = "block";
    };
    reader.readAsDataURL(file);
  }

  // ===================
  // UTILIDADES
  // ===================
  showAlert(message, type = "info") {
    // Crear contenedor de alertas si no existe
    let alertContainer = document.getElementById("alertContainer");
    if (!alertContainer) {
      alertContainer = document.createElement("div");
      alertContainer.id = "alertContainer";
      // CAMBIO: Posición que no tape botones importantes
      alertContainer.className = "position-fixed p-3";
      alertContainer.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 9999;
        max-width: 350px;
        pointer-events: none;
      `;
      document.body.appendChild(alertContainer);
    }

    // Crear alerta con animación mejorada
    const alertId = "alert_" + Date.now();
    const alertDiv = document.createElement("div");
    alertDiv.id = alertId;
    alertDiv.className = `alert alert-${type} alert-dismissible shadow-lg border-0`;
    alertDiv.style.cssText = `
      pointer-events: auto;
      transform: translateX(100%);
      transition: all 0.3s ease;
      margin-bottom: 10px;
      border-left: 4px solid var(--bs-${
        type === "danger"
          ? "danger"
          : type === "success"
          ? "success"
          : type === "warning"
          ? "warning"
          : "info"
      });
    `;

    alertDiv.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="fas fa-${this.getAlertIcon(type)} me-2"></i>
        <div class="flex-grow-1">${message}</div>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;

    // Agregar al contenedor
    alertContainer.appendChild(alertDiv);

    // Animar entrada
    setTimeout(() => {
      alertDiv.style.transform = "translateX(0)";
    }, 10);

    // Auto-dismiss mejorado con animación de salida
    const timeouts = {
      success: 3000,
      info: 4000,
      warning: 5000,
      danger: 6000,
    };

    const dismissTime = timeouts[type] || 4000;

    const autoDismissTimeout = setTimeout(() => {
      this.dismissAlert(alertId);
    }, dismissTime);

    // Manejar cierre manual
    const closeBtn = alertDiv.querySelector(".btn-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        clearTimeout(autoDismissTimeout);
        this.dismissAlert(alertId);
      });
    }

    // Pausar auto-dismiss al hacer hover
    alertDiv.addEventListener("mouseenter", () => {
      clearTimeout(autoDismissTimeout);
    });

    alertDiv.addEventListener("mouseleave", () => {
      setTimeout(() => {
        this.dismissAlert(alertId);
      }, 2000);
    });
  }

  // Función para dismissar alertas con animación
  dismissAlert(alertId) {
    const alertElement = document.getElementById(alertId);
    if (alertElement) {
      // Animar salida
      alertElement.style.transform = "translateX(100%)";
      alertElement.style.opacity = "0";

      // Remover del DOM después de la animación
      setTimeout(() => {
        if (alertElement.parentNode) {
          alertElement.parentNode.removeChild(alertElement);
        }

        // Limpiar contenedor si está vacío
        const container = document.getElementById("alertContainer");
        if (container && container.children.length === 0) {
          container.remove();
        }
      }, 300);
    }
  }

  getAlertIcon(type) {
    const icons = {
      success: "check-circle",
      danger: "exclamation-triangle",
      warning: "exclamation-circle",
      info: "info-circle",
    };
    return icons[type] || "info-circle";
  }
}

// Variables globales
// Variables globales
// Variables globales
let adminPanel;

// Inicializar cuando se carga la página
document.addEventListener("DOMContentLoaded", function () {
  adminPanel = new AdminPanel();
});

// Funciones globales para llamadas desde HTML
function loadDashboard() {
  if (adminPanel) {
    adminPanel.loadDashboard();
  }
}

function loadPedidos() {
  if (adminPanel) {
    adminPanel.loadPedidos();
  }
}
