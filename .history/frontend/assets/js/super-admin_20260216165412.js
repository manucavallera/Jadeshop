// Super Admin Panel JavaScript
class SuperAdminPanel {
  constructor() {
    this.comerciantes = [];
    this.init();
  }

  async init() {
    await this.checkSession();
    this.setupEventListeners();
  }

  async checkSession() {
    try {
      const response = await fetch("/api/super-admin/me");
      if (response.ok) {
        this.showPanel();
      } else {
        this.showLogin();
      }
    } catch (error) {
      this.showLogin();
    }
  }

  showLogin() {
    document.getElementById("loginContainer").classList.remove("d-none");
    document.getElementById("panelContainer").classList.add("d-none");
  }

  showPanel() {
    document.getElementById("loginContainer").classList.add("d-none");
    document.getElementById("panelContainer").classList.remove("d-none");
    this.loadDashboard();
    this.loadComerciantes();
  }

  setupEventListeners() {
    document.getElementById("loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleLogin();
    });

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

    // Filtros
    document.getElementById("searchInput").addEventListener("input", () => {
      this.loadComerciantes();
    });

    document.getElementById("filterPlan").addEventListener("change", () => {
      this.loadComerciantes();
    });

    document.getElementById("filterActivo").addEventListener("change", () => {
      this.loadComerciantes();
    });

    document.getElementById("sortBy").addEventListener("change", () => {
      this.loadComerciantes();
    });

    // Modal guardar
    document
      .getElementById("guardarComercianteBtn")
      .addEventListener("click", () => {
        this.saveComercianteEdit();
      });

    document
      .getElementById("resetPasswordBtn")
      .addEventListener("click", () => {
        this.resetPassword();
      });
  }

  async handleLogin() {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    const btn = document.getElementById("loginBtn");

    btn.disabled = true;
    btn.innerHTML =
      '<span class="spinner-border spinner-border-sm me-2"></span>Ingresando...';

    try {
      const response = await fetch("/api/super-admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (result.success) {
        this.showPanel();
      } else {
        this.showAlert(result.message, "danger");
      }
    } catch (error) {
      this.showAlert("Error de conexión", "danger");
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-lock me-2"></i>Ingresar';
    }
  }

  async handleLogout() {
    await fetch("/api/super-admin/logout", { method: "POST" });
    this.showLogin();
  }

  showSection(section) {
    document.querySelectorAll(".content-section").forEach((s) => {
      s.classList.add("d-none");
    });
    document.getElementById(`${section}-section`).classList.remove("d-none");

    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.remove("active");
    });
    document
      .querySelector(`[data-section="${section}"]`)
      .classList.add("active");

    if (section === "dashboard") this.loadDashboard();
    if (section === "comerciantes") this.loadComerciantes();
  }

  // ===================
  // DASHBOARD
  // ===================
  async loadDashboard() {
    try {
      const response = await fetch("/api/super-admin/dashboard");
      const result = await response.json();

      if (!result.success) throw new Error("Error cargando dashboard");

      const d = result.data;

      document.getElementById("totalComerciantes").textContent =
        d.totalComerciantes;
      document.getElementById("comerciantesActivos").textContent =
        d.comerciantesActivos;
      document.getElementById("comerciantesInactivos").textContent =
        d.comerciantesInactivos;
      document.getElementById("totalProductos").textContent = d.totalProductos;
      document.getElementById("totalPedidos").textContent = d.totalPedidos;
      document.getElementById("ventasTotales").textContent =
        `$${Number(d.ventasTotales).toLocaleString()}`;
      document.getElementById("registrosRecientes").textContent =
        d.registrosRecientes;

      // Planes
      const planesContainer = document.getElementById("planesBreakdown");
      planesContainer.innerHTML = d.porPlan
        .map((p) => {
          const colors = {
            gratis: "secondary",
            basico: "info",
            premium: "warning",
            enterprise: "success",
          };
          return `<span class="badge bg-${colors[p.plan] || "dark"} me-2 mb-1 fs-6">${p.plan}: ${p.count}</span>`;
        })
        .join("");

      // Top tiendas
      const topContainer = document.getElementById("topTiendas");
      topContainer.innerHTML = d.topTiendas
        .map(
          (t, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${t.nombre}</strong> <small class="text-muted">(${t.slug})</small></td>
          <td class="text-center">${t.total_pedidos}</td>
          <td class="text-end">$${Number(t.total_ventas).toLocaleString()}</td>
        </tr>
      `,
        )
        .join("");
    } catch (error) {
      console.error("Error cargando dashboard:", error);
    }
  }

  // ===================
  // COMERCIANTES
  // ===================
  async loadComerciantes() {
    try {
      const search = document.getElementById("searchInput").value;
      const plan = document.getElementById("filterPlan").value;
      const activo = document.getElementById("filterActivo").value;
      const sort = document.getElementById("sortBy").value;

      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (plan) params.append("plan", plan);
      if (activo !== "") params.append("activo", activo);
      if (sort) params.append("sort", sort);

      const response = await fetch(
        `/api/super-admin/comerciantes?${params.toString()}`,
      );
      const result = await response.json();

      if (!result.success) throw new Error("Error");

      this.comerciantes = result.data;

      document.getElementById("totalCount").textContent =
        `${result.total} comerciante${result.total !== 1 ? "s" : ""}`;

      const tbody = document.getElementById("comerciantesTableBody");

      if (result.data.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-4 text-muted">
              No se encontraron comerciantes
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = result.data
        .map(
          (c) => `
        <tr class="${!c.activo ? "table-danger bg-opacity-10" : ""}">
          <td>
            <div class="fw-bold">${c.nombre}</div>
            <small class="text-muted">${c.email}</small>
          </td>
          <td>
            <a href="/${c.slug}" target="_blank" class="text-decoration-none">
              ${c.slug} <i class="fas fa-external-link-alt ms-1" style="font-size:10px"></i>
            </a>
          </td>
          <td>
            <span class="badge bg-${this.getPlanColor(c.plan)}">${c.plan || "gratis"}</span>
          </td>
          <td class="text-center">${c.total_productos}</td>
          <td class="text-center">${c.total_pedidos}</td>
          <td class="text-end">$${Number(c.total_ventas).toLocaleString()}</td>
          <td>
            <span class="badge bg-${c.activo ? "success" : "danger"}">
              ${c.activo ? "Activo" : "Pausado"}
            </span>
          </td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="panel.editComercianteModal(${c.id})" title="Editar">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-outline-${c.activo ? "warning" : "success"}" onclick="panel.toggleComercianteStatus(${c.id})" title="${c.activo ? "Pausar" : "Activar"}">
                <i class="fas fa-${c.activo ? "pause" : "play"}"></i>
              </button>
              <button class="btn btn-outline-danger" onclick="panel.deleteComercianteConfirm(${c.id}, '${c.nombre.replace(/'/g, "\\'")}')" title="Eliminar">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `,
        )
        .join("");
    } catch (error) {
      console.error("Error cargando comerciantes:", error);
    }
  }

  getPlanColor(plan) {
    const colors = {
      gratis: "secondary",
      basico: "info",
      premium: "warning",
      enterprise: "success",
    };
    return colors[plan] || "secondary";
  }

  async editComercianteModal(id) {
    try {
      const response = await fetch(`/api/super-admin/comerciantes/${id}`);
      const result = await response.json();

      if (!result.success) throw new Error("Error");

      const c = result.data;

      document.getElementById("editId").value = c.id;
      document.getElementById("editNombre").value = c.nombre || "";
      document.getElementById("editEmail").value = c.email || "";
      document.getElementById("editWhatsapp").value = c.whatsapp || "";
      document.getElementById("editPlan").value = c.plan || "gratis";
      document.getElementById("editPais").value = c.pais || "";
      document.getElementById("editRubro").value = c.rubro || "";

      // Stats
      document.getElementById("editStats").innerHTML = `
        <div class="row text-center">
          <div class="col-3">
            <div class="fw-bold text-primary">${c.stats.productos}</div>
            <small class="text-muted">Productos</small>
          </div>
          <div class="col-3">
            <div class="fw-bold text-info">${c.stats.pedidos}</div>
            <small class="text-muted">Pedidos</small>
          </div>
          <div class="col-3">
            <div class="fw-bold text-success">$${Number(c.stats.ventas).toLocaleString()}</div>
            <small class="text-muted">Ventas</small>
          </div>
          <div class="col-3">
            <div class="fw-bold text-warning">${c.stats.categorias}</div>
            <small class="text-muted">Categorías</small>
          </div>
        </div>
      `;

      document.getElementById("editModalTitle").textContent =
        `Editar: ${c.nombre}`;

      const modal = new bootstrap.Modal(
        document.getElementById("editComercianteModal"),
      );
      modal.show();
    } catch (error) {
      console.error("Error:", error);
      this.showAlert("Error cargando datos", "danger");
    }
  }

  async saveComercianteEdit() {
    const id = document.getElementById("editId").value;
    const data = {
      nombre: document.getElementById("editNombre").value.trim(),
      email: document.getElementById("editEmail").value.trim(),
      whatsapp: document.getElementById("editWhatsapp").value.trim(),
      plan: document.getElementById("editPlan").value,
      pais: document.getElementById("editPais").value.trim(),
      rubro: document.getElementById("editRubro").value.trim(),
    };

    try {
      const response = await fetch(`/api/super-admin/comerciantes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        this.showAlert("Comerciante actualizado", "success");
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("editComercianteModal"),
        );
        modal.hide();
        this.loadComerciantes();
        this.loadDashboard();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      this.showAlert("Error: " + error.message, "danger");
    }
  }

  async toggleComercianteStatus(id) {
    const comerciante = this.comerciantes.find((c) => c.id === id);
    const action = comerciante.activo ? "PAUSAR" : "ACTIVAR";

    if (
      !confirm(
        `¿${action} la cuenta de "${comerciante.nombre}"?\n\n${comerciante.activo ? "La tienda dejará de estar visible para los clientes." : "La tienda volverá a estar visible."}`,
      )
    )
      return;

    try {
      const response = await fetch(
        `/api/super-admin/comerciantes/${id}/toggle`,
        {
          method: "PUT",
        },
      );

      const result = await response.json();

      if (result.success) {
        this.showAlert(result.message, "success");
        this.loadComerciantes();
        this.loadDashboard();
      }
    } catch (error) {
      this.showAlert("Error cambiando estado", "danger");
    }
  }

  async resetPassword() {
    const id = document.getElementById("editId").value;
    const newPassword = prompt("Nueva contraseña (mínimo 6 caracteres):");

    if (!newPassword) return;
    if (newPassword.length < 6) {
      this.showAlert("Mínimo 6 caracteres", "warning");
      return;
    }

    try {
      const response = await fetch(
        `/api/super-admin/comerciantes/${id}/reset-password`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ new_password: newPassword }),
        },
      );

      const result = await response.json();

      if (result.success) {
        this.showAlert(result.message, "success");
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      this.showAlert("Error: " + error.message, "danger");
    }
  }

  deleteComercianteConfirm(id, nombre) {
    if (
      !confirm(
        `⚠️ ELIMINAR PERMANENTEMENTE "${nombre}"?\n\nSe borrarán TODOS sus datos:\n- Productos\n- Pedidos\n- Categorías\n- Tienda\n\nEsta acción NO se puede deshacer.`,
      )
    )
      return;

    if (!confirm(`¿ESTÁS SEGURO? Escribí "ELIMINAR" mentalmente y confirmá.`))
      return;

    this.deleteComercianteExec(id);
  }

  async deleteComercianteExec(id) {
    try {
      const response = await fetch(`/api/super-admin/comerciantes/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        this.showAlert(result.message, "success");
        this.loadComerciantes();
        this.loadDashboard();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      this.showAlert("Error: " + error.message, "danger");
    }
  }

  showAlert(message, type = "info") {
    let container = document.getElementById("alertContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "alertContainer";
      container.className = "position-fixed p-3";
      container.style.cssText =
        "top: 20px; right: 20px; z-index: 9999; max-width: 400px;";
      document.body.appendChild(container);
    }

    const alertId = "alert_" + Date.now();
    const div = document.createElement("div");
    div.id = alertId;
    div.className = `alert alert-${type} alert-dismissible shadow-lg border-0`;
    div.style.cssText = "transition: all 0.3s ease; margin-bottom: 10px;";
    div.innerHTML = `
      <div class="d-flex align-items-center">
        <div class="flex-grow-1">${message}</div>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    `;

    container.appendChild(div);
    setTimeout(() => {
      if (div.parentNode) div.remove();
    }, 4000);
  }
}

let panel;
document.addEventListener("DOMContentLoaded", () => {
  panel = new SuperAdminPanel();
});
