// AuthManager - Manejo de autenticación híbrida con auto-logout por inactividad
class AuthManager {
  constructor() {
    this.usuario = null;
    this.inactivityTimer = null;
    this.inactivityTimeout = 30 * 60 * 1000; // 30 minutos por defecto
    this.warningTimeout = 28 * 60 * 1000; // Advertencia 2 minutos antes
    this.warningTimer = null;
    this.init();
  }

  init() {
    // Verificar si hay usuario logueado
    const usuarioGuardado = localStorage.getItem("usuario");
    if (usuarioGuardado) {
      try {
        this.usuario = JSON.parse(usuarioGuardado);
        this.updateUIForLoggedUser();
        this.startInactivityTimer(); // Iniciar timer al cargar usuario
      } catch (error) {
        console.error("Error cargando usuario guardado:", error);
        localStorage.removeItem("usuario");
      }
    }

    // Event listeners
    this.setupEventListeners();
    this.setupInactivityListeners();
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

  // ========================================
  // SISTEMA DE INACTIVIDAD
  // ========================================

  setupInactivityListeners() {
    // Eventos que resetean el timer de inactividad
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    events.forEach((event) => {
      document.addEventListener(
        event,
        () => {
          if (this.isLoggedIn()) {
            this.resetInactivityTimer();
          }
        },
        true
      );
    });
  }

  startInactivityTimer() {
    this.clearInactivityTimers();

    // Timer de advertencia (2 minutos antes de cerrar sesión)
    this.warningTimer = setTimeout(() => {
      this.showInactivityWarning();
    }, this.warningTimeout);

    // Timer de logout automático
    this.inactivityTimer = setTimeout(() => {
      this.autoLogout();
    }, this.inactivityTimeout);
  }

  resetInactivityTimer() {
    if (this.isLoggedIn()) {
      this.clearInactivityTimers();
      this.startInactivityTimer();

      // Cerrar advertencia si está abierta
      const warningModal = document.getElementById("inactivityWarningModal");
      if (warningModal) {
        const modal = bootstrap.Modal.getInstance(warningModal);
        if (modal) modal.hide();
      }
    }
  }

  clearInactivityTimers() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
  }

  showInactivityWarning() {
    const warningHTML = `
      <div class="text-center py-3">
        <i class="fas fa-clock text-warning" style="font-size: 3rem;"></i>
        <h5 class="mt-3">Tu sesión está por expirar</h5>
        <p class="text-muted">Por inactividad, tu sesión se cerrará en 2 minutos.</p>
        <p class="mb-0">¿Deseas continuar con tu sesión?</p>
      </div>
    `;

    this.createModal("inactivityWarningModal", "Sesión Inactiva", warningHTML, [
      {
        text: "Cerrar Sesión",
        class: "btn-outline-secondary",
        onclick: () => this.logout(),
      },
      {
        text: "Continuar Sesión",
        class: "btn-primary",
        onclick: () => this.extendSession(),
      },
    ]);
  }

  extendSession() {
    // Cerrar modal de advertencia
    const warningModal = document.getElementById("inactivityWarningModal");
    if (warningModal) {
      const modal = bootstrap.Modal.getInstance(warningModal);
      if (modal) modal.hide();
    }

    // Resetear timer
    this.resetInactivityTimer();
    this.showAlert("Sesión extendida correctamente", "success");
  }

  autoLogout() {
    this.showAlert("Tu sesión ha expirado por inactividad", "warning");

    // Esperar 2 segundos para que vean el mensaje
    setTimeout(() => {
      this.usuario = null;
      localStorage.removeItem("usuario");
      localStorage.removeItem("usuario_welcomed");
      this.clearInactivityTimers();
      location.reload();
    }, 2000);
  }

  // Método para cambiar el tiempo de inactividad (útil para testing o configuración)
  setInactivityTimeout(minutes) {
    this.inactivityTimeout = minutes * 60 * 1000;
    this.warningTimeout = (minutes - 2) * 60 * 1000; // Advertencia 2 min antes

    if (this.isLoggedIn()) {
      this.resetInactivityTimer();
    }
  }

  // ========================================
  // MÉTODOS EXISTENTES
  // ========================================

  async checkExistingEmail() {
    const email = document.getElementById("loginEmail").value.trim();
    if (!email) return;

    try {
      const response = await fetch(`/api/auth/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          document.getElementById("loginNombre").value = data.nombre || "";
          document.getElementById("loginTelefono").value = data.telefono || "";
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

    if (!this.isValidEmail(email)) {
      this.showAlert("Por favor, ingresa un email válido", "warning");
      return;
    }

    this.setLoginLoading(true);

    try {
      const response = await fetch("/api/auth/login-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nombre, telefono }),
      });

      const data = await response.json();

      if (data.success) {
        this.usuario = data.usuario;
        localStorage.setItem("usuario", JSON.stringify(this.usuario));

        const modal = bootstrap.Modal.getInstance(
          document.getElementById("loginModal")
        );
        modal.hide();

        this.updateUIForLoggedUser();
        this.showWelcomeMessage();
        this.startInactivityTimer(); // Iniciar timer al hacer login
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
    const cartButton = document.getElementById("cartButton");
    if (cartButton && !document.getElementById("userButton")) {
      const userButton = document.createElement("button");
      userButton.id = "userButton";
      userButton.className = "btn btn-outline-secondary me-2";
      userButton.innerHTML = `<i class="fas fa-user me-1"></i>${this.getFirstName()}`;
      userButton.onclick = () => this.showUserMenu();
      cartButton.parentNode.insertBefore(userButton, cartButton);
    }

    this.prefillCheckoutData();
  }

  getFirstName() {
    if (!this.usuario || !this.usuario.nombre) return "Usuario";
    return this.usuario.nombre.split(" ")[0];
  }

  prefillCheckoutData() {
    if (!this.usuario) return;

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

    const userButton = document.getElementById("userButton");
    userButton.style.position = "relative";
    userButton.appendChild(menu);

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
            <span class="badge bg-${this.getStatusColor(pedido.estado)}">${
          pedido.estado
        }</span>
          </div>
          ${
            pedido.items && pedido.items.length > 0
              ? `
            <div class="mt-2">
              <small class="text-muted">Productos:</small>
              <ul class="list-unstyled small mt-1">
                ${pedido.items
                  .map(
                    (item) =>
                      `<li>• ${item.producto_nombre} (${item.cantidad}x)</li>`
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
        body: JSON.stringify({ email: this.usuario.email, nombre, telefono }),
      });

      const data = await response.json();

      if (data.success) {
        this.usuario = data.usuario;
        localStorage.setItem("usuario", JSON.stringify(this.usuario));

        const modal = bootstrap.Modal.getInstance(
          document.getElementById("profileModal")
        );
        modal.hide();

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
      this.clearInactivityTimers();
      location.reload();
    }
  }

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

  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  showAlert(message, type = "info") {
    let alertContainer = document.getElementById("alertContainer");
    if (!alertContainer) {
      alertContainer = document.createElement("div");
      alertContainer.id = "alertContainer";
      alertContainer.className = "position-fixed top-0 end-0 p-3";
      alertContainer.style.zIndex = "9999";
      document.body.appendChild(alertContainer);
    }

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

// Ejemplo de uso para cambiar el tiempo de inactividad:
// authManager.setInactivityTimeout(15); // 15 minutos
// authManager.setInactivityTimeout(5);  // 5 minutos (útil para testing)
