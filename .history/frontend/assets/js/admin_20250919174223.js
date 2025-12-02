// Admin Panel JavaScript - Multi-tenant
class AdminPanel {
  constructor() {
    this.currentSection = "dashboard";
    this.editingProduct = null;
    this.charts = {
      ventas: null,
      productos: null,
    };

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
                    <td>$${Number(producto.precio).toLocaleString()}</td>
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
    const form = document.getElementById("productoForm");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Verificar si hay nueva imagen para subir
    const imagenFile = document.getElementById("productoImagenFile").files[0];
    let imagen_url = document.getElementById("productoImagen").value;

    // Si hay archivo, subirlo primero
    if (imagenFile) {
      this.showAlert("Subiendo imagen...", "info");
      imagen_url = await this.uploadImagen(imagenFile);

      if (!imagen_url) {
        return; // Error en la subida
      }
    }

    const productData = {
      nombre: document.getElementById("productoNombre").value,
      descripcion: document.getElementById("productoDescripcion").value,
      precio: parseFloat(document.getElementById("productoPrecio").value),
      stock: parseInt(document.getElementById("productoStock").value),
      categoria: document.getElementById("productoCategoria").value,
      imagen_url: imagen_url,
    };

    try {
      const url = this.editingProduct
        ? `/api/admin/productos/${this.editingProduct}`
        : "/api/admin/productos";

      const method = this.editingProduct ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productData),
      });

      if (response.ok) {
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

        this.loadProductos();
        this.loadDashboard(); // Actualizar dashboard
      } else {
        throw new Error("Error al guardar producto");
      }
    } catch (error) {
      console.error("Error guardando producto:", error);
      this.showAlert("Error al guardar el producto", "danger");
    }
  }

  async editProduct(id) {
    try {
      const response = await fetch("/api/admin/productos");
      const productos = await response.json();
      const producto = productos.find((p) => p.id === id);

      if (!producto) {
        this.showAlert("Producto no encontrado", "danger");
        return;
      }

      // Llenar formulario
      document.getElementById("productoNombre").value = producto.nombre;
      document.getElementById("productoDescripcion").value =
        producto.descripcion || "";
      document.getElementById("productoPrecio").value = producto.precio;
      document.getElementById("productoStock").value = producto.stock;
      document.getElementById("productoCategoria").value = producto.categoria;
      document.getElementById("productoImagen").value =
        producto.imagen_url || "";

      // Cambiar título del modal
      document.getElementById("productoModalTitle").textContent =
        "Editar Producto";

      this.editingProduct = id;

      // Mostrar modal
      const modal = new bootstrap.Modal(
        document.getElementById("productoModal")
      );
      modal.show();
    } catch (error) {
      console.error("Error cargando producto para editar:", error);
      this.showAlert("Error cargando el producto", "danger");
    }
  }

  async deleteProduct(id) {
    if (!confirm("¿Estás seguro de que quieres eliminar este producto?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/productos/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        this.showAlert("Producto eliminado correctamente", "success");
        this.loadProductos();
        this.loadDashboard(); // Actualizar dashboard
      } else {
        throw new Error("Error al eliminar producto");
      }
    } catch (error) {
      console.error("Error eliminando producto:", error);
      this.showAlert("Error al eliminar el producto", "danger");
    }
  }

  resetProductForm() {
    document.getElementById("productoForm").reset();
    document.getElementById("productoModalTitle").textContent =
      "Nuevo Producto";
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
      alertContainer.className = "position-fixed top-0 end-0 p-3";
      alertContainer.style.zIndex = "9999";
      document.body.appendChild(alertContainer);
    }

    // Crear alerta
    const alertId = "alert_" + Date.now();
    const alertHtml = `
            <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
                <i class="fas fa-${this.getAlertIcon(type)} me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;

    alertContainer.insertAdjacentHTML("beforeend", alertHtml);

    // Auto-dismiss después de 5 segundos
    setTimeout(() => {
      const alertElement = document.getElementById(alertId);
      if (alertElement) {
        const alert = bootstrap.Alert.getInstance(alertElement);
        if (alert) {
          alert.close();
        }
      }
    }, 5000);
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
