// Registro de Comerciantes
class RegistroComeriante {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupSlugPreview();
  }

  setupEventListeners() {
    // Formulario
    document
      .getElementById("registrationForm")
      .addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleRegistration();
      });

    // Preview del slug
    document.getElementById("nombreUsuario").addEventListener("input", (e) => {
      this.updateSlugPreview(e.target.value);
    });

    // Auto-generar slug desde nombre comercio
    document.getElementById("nombreComercio").addEventListener("input", (e) => {
      const slug = this.generateSlugFromName(e.target.value);
      document.getElementById("nombreUsuario").value = slug;
      this.updateSlugPreview(slug);
    });

    // Sincronizar teléfonos
    document
      .getElementById("whatsappComercio")
      .addEventListener("input", (e) => {
        const personalPhone = document.getElementById("telefonoPersonal");
        if (!personalPhone.value) {
          personalPhone.value = e.target.value;
        }
      });

    // Sincronizar códigos de país
    document.getElementById("codigoPais").addEventListener("change", (e) => {
      const personalCode = document.getElementById("codigoPaisPersonal");
      if (personalCode.value === "+54") {
        // Si está en default
        personalCode.value = e.target.value;
      }
    });
  }

  setupSlugPreview() {
    // Inicializar preview
    this.updateSlugPreview("mi-tienda");
  }

  generateSlugFromName(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "") // Remover caracteres especiales
      .replace(/\s+/g, "-") // Espacios a guiones
      .replace(/-+/g, "-") // Múltiples guiones a uno
      .substring(0, 30); // Limitar longitud
  }

  updateSlugPreview(slug) {
    const cleanSlug = this.cleanSlug(slug);
    document.getElementById("slugPreview").textContent =
      cleanSlug || "mi-tienda";

    // Validar disponibilidad del slug
    if (cleanSlug && cleanSlug.length >= 3) {
      this.checkSlugAvailability(cleanSlug);
    }
  }

  cleanSlug(slug) {
    return slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async checkSlugAvailability(slug) {
    try {
      const response = await fetch(`/api/comerciantes/check-slug/${slug}`);
      const result = await response.json();

      const input = document.getElementById("nombreUsuario");
      const preview = document.getElementById("slugPreview");

      if (result.available) {
        input.classList.remove("is-invalid");
        input.classList.add("is-valid");
        preview.style.color = "#198754";
      } else {
        input.classList.remove("is-valid");
        input.classList.add("is-invalid");
        preview.style.color = "#dc3545";

        // Mostrar mensaje de error
        this.showSlugError("Este nombre ya está en uso");
      }
    } catch (error) {
      console.warn("Error verificando disponibilidad:", error);
    }
  }

  showSlugError(message) {
    const input = document.getElementById("nombreUsuario");
    let feedback = input.parentNode.querySelector(".invalid-feedback");

    if (!feedback) {
      feedback = document.createElement("div");
      feedback.className = "invalid-feedback";
      input.parentNode.appendChild(feedback);
    }

    feedback.textContent = message;
  }

  async handleRegistration() {
    const formData = this.collectFormData();

    if (!this.validateForm(formData)) {
      return;
    }

    this.setLoading(true);

    try {
      const response = await fetch("/api/comerciantes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        this.showSuccess(result.data);
      } else {
        this.showError(result.message || "Error creando la tienda");
      }
    } catch (error) {
      console.error("Error en registro:", error);
      this.showError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      this.setLoading(false);
    }
  }

  collectFormData() {
    const codigoPais = document.getElementById("codigoPais").value;
    const codigoPaisPersonal =
      document.getElementById("codigoPaisPersonal").value;

    return {
      // Datos del comerciante
      email: document.getElementById("email").value.trim(),
      nombre: document.getElementById("nombreComercio").value.trim(),
      telefono:
        codigoPaisPersonal +
        document.getElementById("telefonoPersonal").value.trim(),
      slug: this.cleanSlug(document.getElementById("nombreUsuario").value),
      pais: document.getElementById("pais").value,

      // Datos de la tienda
      tienda_nombre: document.getElementById("nombreComercio").value.trim(),
      rubro: document.getElementById("rubroComercio").value,
      whatsapp:
        codigoPais + document.getElementById("whatsappComercio").value.trim(),
    };
  }

  validateForm(data) {
    const errors = [];

    // Validaciones básicas
    if (!data.email) errors.push("Email es requerido");
    if (!data.nombre) errors.push("Nombre del comercio es requerido");
    if (!data.slug || data.slug.length < 3)
      errors.push("Nombre de usuario debe tener al menos 3 caracteres");
    if (!data.whatsapp) errors.push("WhatsApp es requerido");
    if (!data.rubro) errors.push("Rubro es requerido");
    if (!data.pais) errors.push("País es requerido");

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (data.email && !emailRegex.test(data.email)) {
      errors.push("Email no válido");
    }

    // Validar slug
    const slugRegex = /^[a-z0-9-]+$/;
    if (data.slug && !slugRegex.test(data.slug)) {
      errors.push(
        "Nombre de usuario solo puede contener letras, números y guiones"
      );
    }

    // Validar teléfono
    if (data.whatsapp && data.whatsapp.length < 8) {
      errors.push("Número de WhatsApp no válido");
    }

    // Términos y condiciones
    if (!document.getElementById("terminos").checked) {
      errors.push("Debes aceptar los términos y condiciones");
    }

    if (errors.length > 0) {
      this.showValidationErrors(errors);
      return false;
    }

    return true;
  }

  showValidationErrors(errors) {
    const errorHTML = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <h6><i class="fas fa-exclamation-triangle me-2"></i>Por favor corrige los siguientes errores:</h6>
                <ul class="mb-0">
                    ${errors.map((error) => `<li>${error}</li>`).join("")}
                </ul>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;

    const container = document.querySelector(".form-section");
    const existingAlert = container.querySelector(".alert");

    if (existingAlert) {
      existingAlert.remove();
    }

    container.insertAdjacentHTML("afterbegin", errorHTML);

    // Scroll al error
    container.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  showSuccess(data) {
    // Crear modal de éxito
    const modalHTML = `
            <div class="modal fade" id="successModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-body text-center p-5">
                            <div class="mb-4">
                                <i class="fas fa-check-circle text-success" style="font-size: 4rem;"></i>
                            </div>
                            
                            <h3 class="mb-3">¡Tienda creada exitosamente!</h3>
                            
                            <p class="text-muted mb-4">
                                Tu tienda <strong>${data.tienda.nombre}</strong> está lista para usar
                            </p>
                            
                            <div class="alert alert-info">
                                <h6><i class="fas fa-link me-2"></i>Tu tienda está disponible en:</h6>
                                <a href="${data.url}" target="_blank" class="text-decoration-none fw-bold">
                                    ${data.url}
                                </a>
                            </div>
                            
                            <div class="d-grid gap-2">
                                <a href="${data.url}" class="btn btn-success btn-lg">
                                    <i class="fas fa-store me-2"></i>
                                    Ver mi tienda
                                </a>
                                
                                <a href="/admin/" class="btn btn-outline-primary">
                                    <i class="fas fa-cog me-2"></i>
                                    Panel de administración
                                </a>
                            </div>
                            
                            <div class="mt-4 pt-3 border-top">
                                <h6 class="text-muted">Próximos pasos:</h6>
                                <small class="text-muted">
                                    1. Agrega productos a tu tienda<br>
                                    2. Personaliza colores y logo<br>
                                    3. ¡Empieza a vender!
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
    const modal = new bootstrap.Modal(document.getElementById("successModal"));
    modal.show();
  }

  showError(message) {
    const errorHTML = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <h6><i class="fas fa-exclamation-triangle me-2"></i>Error</h6>
                <p class="mb-0">${message}</p>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;

    const container = document.querySelector(".form-section");
    const existingAlert = container.querySelector(".alert");

    if (existingAlert) {
      existingAlert.remove();
    }

    container.insertAdjacentHTML("afterbegin", errorHTML);
    container.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  setLoading(loading) {
    const btn = document.getElementById("btnCrear");
    const btnText = document.getElementById("btnText");
    const btnSpinner = document.getElementById("btnSpinner");

    if (loading) {
      btn.disabled = true;
      btnText.classList.add("d-none");
      btnSpinner.classList.remove("d-none");
    } else {
      btn.disabled = false;
      btnText.classList.remove("d-none");
      btnSpinner.classList.add("d-none");
    }
  }
}

// Inicializar cuando se carga la página
document.addEventListener("DOMContentLoaded", function () {
  new RegistroComeriante();
});
