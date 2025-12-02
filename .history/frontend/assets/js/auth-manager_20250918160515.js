// AuthManager - Manejo de autenticación híbrida
class AuthManager {
  constructor() {
    this.usuario = null;
    this.init();
  }

  init() {
    // Verificar si hay usuario logueado
    const usuarioGuardado = localStorage.getItem("usuario");
    if (usuarioGuardado) {
      try {
        this.usuario = JSON.parse(usuarioGuardado);
        this.updateUIForLoggedUser();
      } catch (error) {
        console.error("Error cargando usuario guardado:", error);
        localStorage.removeItem("usuario");
      }
    }

    // Event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Botón de login
    document.addEventListener("DOMContentLoaded", () => {
      const btnLogin = document.getElementById("btnLogin");
      if (btnLogin) {
        btnLogin.addEventListener("click", () => {
          this.handleLogin();
        });
      }

      // Enter en el formulario
      const loginForm = document.getElementById("loginForm");
      if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
          e.preventDefault();
          this.handleLogin();
        });
      }

      // Auto-completar cuando se ingresa email
      const emailInput = document.getElementById("loginEmail");
      if (emailInput) {
        emailInput.addEventListener("blur", () => {
          this.checkExistingEmail();
        });
      }
    });
  }

  async checkExistingEmail() {
    const email = document.getElementById("loginEmail").value.trim();
    if (!email) return;

    try {
      // Verificar si el email ya existe sin hacer login
      const response = await fetch(`/api/auth/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          // Auto-completar datos
          document.getElementById("loginNombre").value = data.nombre || "";
          document.getElementById("loginTelefono").value = data.telefono || "";

          // Cambiar texto para indicar que es login
          document.querySelector(".modal-title").textContent =
            "Bienvenido de vuelta";
          document.getElementById("loginBtnText").textContent =
            "Iniciar Sesión";
        }
      }
    } catch (error) {
      console.warn("No se pudo verificar el email:", error);
    }
  }

  async handleLogin() {
    const email = document.getElementById("loginEmail").value.trim();
    const nombre = document.getElementById("loginNombre").value.trim();
    const telefono = document.getElementById("loginTelefono").value.trim();

    if (!email || !nombre) {
      this.showAlert("Por favor, completa email y nombre", "warning");
      return;
    }

    // Validar email básico
    if (!this.isValidEmail(email)) {
      this.showAlert("Por favor, ingresa un email válido", "warning");
      return;
    }

    // Mostrar loading
    this.setLoginLoading(true);

    try {
      const response = await fetch("/api/auth/login-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, nombre, telefono }),
      });

      const data = await response.json();

      if (data.success) {
        this.usuario = data.usuario;
        localStorage.setItem("usuario", JSON.stringify(this.usuario));

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("loginModal")
        );
        modal.hide();

        // Actualizar UI
        this.updateUIForLoggedUser();

        // Mostrar mensaje de bienvenida
        this.showWelcomeMessage();

        // Continuar con el checkout si había productos en carrito
        this.proceedToCheckout();
      } else {
        this.showAlert("Error: " + data.error, "danger");
      }
    } catch (error) {
      console.error("Error en login:", error);
      this.showAlert("Error de conexión. Inténtalo de nuevo.", "danger");
    } finally {
      this.setLoginLoading(false);
    }
  }

  setLoginLoading(loading) {
    const btnText = document.getElementById("loginBtnText");
    const spinner = document.getElementById("loginSpinner");
    const btn = document.getElementById("btnLogin");

    if (loading) {
      btnText.textContent = "Procesando...";
      spinner.classList.remove("d-none");
      btn.disabled = true;
    } else {
      btnText.textContent = "Continuar";
      spinner.classList.add("d-none");
      btn.disabled = false;
    }
  }

  updateUIForLoggedUser() {
    // Agregar botón de usuario al header
    const cartButton = document.getElementById("cartButton");
    if (cartButton && !document.getElementById("userButton")) {
      const userButton = document.createElement("button");
      userButton.id = "userButton";
      userButton.className = "btn btn-outline-secondary me-2";
      userButton.innerHTML = `<i class="fas fa-user me-1"></i>${this.getFirstName()}`;
      userButton.onclick = () => this.showUserMenu();

      cartButton.parentNode.insertBefore(userButton, cartButton);
    }

    // Pre-llenar datos en cualquier formulario de checkout
    this.prefillCheckoutData();
  }

  getFirstName() {
    if (!this.usuario || !this.usuario.nombre) return "Usuario";
    return this.usuario.nombre.split(" ")[0];
  }

  prefillCheckoutData() {
    if (!this.usuario) return;

    // Buscar campos comunes y pre-llenarlos
    setTimeout(() => {
      const emailField = document.querySelector(
        '#customerEmail, input[type="email"]'
      );
      const nameField = document.querySelector(
        '#customerName, input[placeholder*="nombre"], input[placeholder*="Nombre"]'
      );
      const phoneField = document.querySelector(
        '#customerPhone, input[type="tel"], input[placeholder*="teléfono"]'
      );

      if (emailField && !emailField.value)
        emailField.value = this.usuario.email;
      if (nameField && !nameField.value) nameField.value = this.usuario.nombre;
      if (phoneField && !phoneField.value && this.usuario.telefono)
        phoneField.value = this.usuario.telefono;
    }, 100);
  }

  showWelcomeMessage() {
    const isNewUser = !localStorage.getItem("usuario_welcomed");
    const message = isNewUser
      ? `¡Bienvenido ${this.getFirstName()}! Tu cuenta ha sido creada.`
      : `¡Hola de nuevo ${this.getFirstName()}!`;

    this.showAlert(message, "success");

    if (isNewUser) {
      localStorage.setItem("usuario_welcomed", "true");
    }
  }

  showUserMenu() {
    // Crear menú desplegable simple
    const existingMenu = document.getElementById("userDropdown");
    if (existingMenu) {
      existingMenu.remove();
      return;
    }

    const menu = document.createElement("div");
    menu.id = "userDropdown";
    menu.className = "position-absolute bg-white border rounded shadow-sm p-2";
    menu.style.cssText =
      "top: 100%; right: 0; z-index: 1050; min-width: 200px;";

    menu.innerHTML = `
            <div class="d-grid gap-2">
                <button class="btn btn-sm btn-outline-primary" onclick="authManager.showOrderHistory()">
                    <i class="fas fa-history me-1"></i>Mis Pedidos
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="authManager.showProfile()">
                    <i class="fas fa-user me-1"></i>Mi Perfil
                </button>
                <hr class="my-2">
                <button class="btn btn-sm btn-outline-danger" onclick="authManager.logout()">
                    <i class="fas fa-sign-out-alt me-1"></i>Cerrar Sesión
                </button>
            </div>
        `;

    // Posicionar relativo al botón de usuario
    const userButton = document.getElementById("userButton");
    userButton.style.position = "relative";
    userButton.appendChild(menu);

    // Cerrar al hacer click fuera
    setTimeout(() => {
      document.addEventListener("click", function closeMenu(e) {
        if (!userButton.contains(e.target)) {
          menu.remove();
          document.removeEventListener("click", closeMenu);
        }
      });
    }, 100);
  }

  async showOrderHistory() {
    document.getElementById("userDropdown")?.remove();

    try {
      const response = await fetch(`/api/auth/pedidos/${this.usuario.id}`);
      const pedidos = await response.json();

      this.createModal(
        "historialModal",
        "Mi Historial de Pedidos",
        this.generateOrderHistoryHTML(pedidos)
      );
    } catch (error) {
      console.error("Error cargando historial:", error);
      this.showAlert("Error cargando historial de pedidos", "danger");
    }
  }

  generateOrderHistoryHTML(pedidos) {
    if (pedidos.length === 0) {
      return '<div class="text-center py-4"><p class="text-muted">Aún no tienes pedidos realizados.</p></div>';
    }

    return pedidos
      .map(
        (pedido) => `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="card-title">Pedido #${pedido.id}</h6>
                            <p class="card-text mb-1">Total: $${Number(
                              pedido.total
                            ).toLocaleString()}</p>
                            <small class="text-muted">${new Date(
                              pedido.created_at
                            ).toLocaleDateString()}</small>
                        </div>
                        <span class="badge bg-${this.getStatusColor(
                          pedido.estado
                        )}">${pedido.estado}</span>
                    </div>
                    
                    ${
                      pedido.items && pedido.items.length > 0
                        ? `
                        <div class="mt-2">
                            <small class="text-muted">Productos:</small>
                            <ul class="list-unstyled small mt-1">
                                ${pedido.items
                                  .map(
                                    (item) => `
                                    <li>• ${item.producto_nombre} (${item.cantidad}x)</li>
                                `
                                  )
                                  .join("")}
                            </ul>
                        </div>
                    `
                        : ""
                    }
                </div>
            </div>
        `
      )
      .join("");
  }

  getStatusColor(estado) {
    const colors = {
      pendiente: "warning",
      confirmado: "info",
      preparando: "primary",
      enviado: "success",
      entregado: "success",
      cancelado: "danger",
    };
    return colors[estado] || "secondary";
  }

  showProfile() {
    document.getElementById("userDropdown")?.remove();

    const profileHTML = `
            <form id="profileForm">
                <div class="mb-3">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-control" value="${
                      this.usuario.email
                    }" readonly>
                    <small class="text-muted">El email no se puede cambiar</small>
                </div>
                <div class="mb-3">
                    <label class="form-label">Nombre completo</label>
                    <input type="text" class="form-control" id="profileNombre" value="${
                      this.usuario.nombre
                    }">
                </div>
                <div class="mb-3">
                    <label class="form-label">Teléfono</label>
                    <input type="tel" class="form-control" id="profileTelefono" value="${
                      this.usuario.telefono || ""
                    }">
                </div>
            </form>
        `;

    this.createModal("profileModal", "Mi Perfil", profileHTML, [
      { text: "Cancelar", class: "btn-secondary" },
      {
        text: "Guardar Cambios",
        class: "btn-primary",
        onclick: () => this.updateProfile(),
      },
    ]);
  }

  async updateProfile() {
    const nombre = document.getElementById("profileNombre").value.trim();
    const telefono = document.getElementById("profileTelefono").value.trim();

    if (!nombre) {
      this.showAlert("El nombre es requerido", "warning");
      return;
    }

    try {
      const response = await fetch("/api/auth/login-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: this.usuario.email,
          nombre,
          telefono,
        }),
      });

      const data = await response.json();

      if (data.success) {
        this.usuario = data.usuario;
        localStorage.setItem("usuario", JSON.stringify(this.usuario));

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("profileModal")
        );
        modal.hide();

        // Actualizar UI
        this.updateUIForLoggedUser();

        this.showAlert("Perfil actualizado correctamente", "success");
      } else {
        this.showAlert("Error actualizando perfil: " + data.error, "danger");
      }
    } catch (error) {
      console.error("Error actualizando perfil:", error);
      this.showAlert("Error de conexión", "danger");
    }
  }

  createModal(
    id,
    title,
    bodyHTML,
    buttons = [{ text: "Cerrar", class: "btn-secondary" }]
  ) {
    // Remover modal anterior si existe
    const existingModal = document.getElementById(id);
    if (existingModal) existingModal.remove();

    const buttonsHTML = buttons
      .map(
        (btn) =>
          `<button type="button" class="btn ${btn.class}" ${
            btn.onclick
              ? `onclick="${btn.onclick.name}()"`
              : 'data-bs-dismiss="modal"'
          }>
                ${btn.text}
            </button>`
      )
      .join("");

    const modalHTML = `
            <div class="modal fade" id="${id}" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">${bodyHTML}</div>
                        <div class="modal-footer">${buttonsHTML}</div>
                    </div>
                </div>
            </div>
        `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    const modal = new bootstrap.Modal(document.getElementById(id));
    modal.show();

    // Limpiar cuando se cierre
    document
      .getElementById(id)
      .addEventListener("hidden.bs.modal", function () {
        this.remove();
      });
  }

  logout() {
    if (confirm("¿Seguro que quieres cerrar sesión?")) {
      this.usuario = null;
      localStorage.removeItem("usuario");
      localStorage.removeItem("usuario_welcomed");
      location.reload();
    }
  }

  // Métodos públicos para integrar con el checkout
  isLoggedIn() {
    return this.usuario !== null;
  }

  getUsuario() {
    return this.usuario;
  }

  requireLogin(callback) {
    if (!this.isLoggedIn()) {
      this.showLoginModal(callback);
      return false;
    }
    if (callback) callback();
    return true;
  }

  showLoginModal(callback) {
    this.loginCallback = callback;
    const modal = new bootstrap.Modal(document.getElementById("loginModal"));
    modal.show();
  }

  proceedToCheckout() {
    if (this.loginCallback) {
      this.loginCallback();
      this.loginCallback = null;
    }
  }

  // Utilidades
  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

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
    const icons = {
      success: "check-circle",
      danger: "exclamation-triangle",
      warning: "exclamation-circle",
      info: "info-circle",
    };

    const alertHTML = `
            <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
                <i class="fas fa-${icons[type] || "info-circle"} me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;

    alertContainer.insertAdjacentHTML("beforeend", alertHTML);

    // Auto-dismiss después de 4 segundos
    setTimeout(() => {
      const alertElement = document.getElementById(alertId);
      if (alertElement) {
        const alert = bootstrap.Alert.getInstance(alertElement);
        if (alert) {
          alert.close();
        } else {
          alertElement.remove();
        }
      }
    }, 4000);
  }
}

// Instancia global
const authManager = new AuthManager();
