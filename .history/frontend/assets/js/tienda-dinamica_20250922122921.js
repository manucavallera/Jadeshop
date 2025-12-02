// Tienda Dinámica - Sistema Multi-tenant
class TiendaDinamica {
  constructor() {
    this.slug = this.getSlugFromURL();
    this.tiendaData = null;
    this.productos = [];
    this.productosFiltrados = [];
    this.carrito = this.loadCarrito();
    this.init();
  }

  getSlugFromURL() {
    const path = window.location.pathname;
    return path.substring(1); // Remover el primer "/"
  }

  loadCarrito() {
    const saved = localStorage.getItem(`carrito_${this.slug}`);
    return saved ? JSON.parse(saved) : [];
  }

  saveCarrito() {
    localStorage.setItem(`carrito_${this.slug}`, JSON.stringify(this.carrito));
  }

  async init() {
    try {
      await this.loadTiendaData();
      await this.loadProductos();
      this.setupEventListeners();
      this.updateCartUI();
      this.hideInitialLoading();
    } catch (error) {
      console.error("Error inicializando tienda:", error);
      this.showError("Error cargando la tienda");
    }
  }

  async loadTiendaData() {
    try {
      const response = await fetch(`/api/comerciantes/${this.slug}`);

      if (!response.ok) {
        throw new Error("Tienda no encontrada");
      }

      const result = await response.json();
      this.tiendaData = result.data;

      this.updateTiendaUI();
    } catch (error) {
      console.error("Error cargando datos de tienda:", error);
      throw error;
    }
  }

  updateTiendaUI() {
    const data = this.tiendaData;

    // Actualizar título de página
    document.getElementById("pageTitle").textContent = data.nombre;

    // Actualizar header
    document.getElementById("tiendaNombre").textContent = data.nombre;
    document.getElementById("tiendaDescripcion").textContent =
      data.descripcion || "";

    // Logo si existe
    if (data.logo_url) {
      const logo = document.getElementById("tiendaLogo");
      logo.src = data.logo_url;
      logo.classList.remove("d-none");
    }

    // Actualizar colores CSS
    if (data.color_primario || data.color_secundario) {
      const root = document.documentElement;
      if (data.color_primario) {
        root.style.setProperty("--primary-color", data.color_primario);
      }
      if (data.color_secundario) {
        root.style.setProperty("--secondary-color", data.color_secundario);
      }
    }

    // Footer
    document.getElementById("footerNombre").textContent = data.nombre;

    // Redes sociales
    this.updateSocialLinks();
  }

  updateSocialLinks() {
    const container = document.getElementById("socialLinks");
    const data = this.tiendaData;
    let links = [];

    if (data.whatsapp) {
      links.push(`<a href="https://wa.me/${data.whatsapp}" target="_blank" class="btn btn-outline-success btn-sm me-2">
                <i class="fab fa-whatsapp"></i> WhatsApp
            </a>`);
    }

    if (data.instagram) {
      links.push(`<a href="https://instagram.com/${data.instagram}" target="_blank" class="btn btn-outline-primary btn-sm me-2">
                <i class="fab fa-instagram"></i> Instagram
            </a>`);
    }

    if (data.tiktok) {
      links.push(`<a href="https://tiktok.com/@${data.tiktok}" target="_blank" class="btn btn-outline-dark btn-sm">
                <i class="fab fa-tiktok"></i> TikTok
            </a>`);
    }

    container.innerHTML = links.join("");
  }

  async loadProductos() {
    try {
      document.getElementById("loading").classList.remove("d-none");

      const response = await fetch(`/api/comerciantes/${this.slug}/productos`);
      const result = await response.json();

      if (result.success) {
        this.productos = result.data;
        this.productosFiltrados = [...this.productos];

        this.updateCategoryFilters();
        this.renderProductos();
      } else {
        throw new Error(result.message || "Error cargando productos");
      }
    } catch (error) {
      console.error("Error cargando productos:", error);
      this.showError("Error cargando productos");
    } finally {
      document.getElementById("loading").classList.add("d-none");
    }
  }

  updateCategoryFilters() {
    const categorias = [
      ...new Set(this.productos.map((p) => p.categoria).filter((c) => c)),
    ];
    const container = document.getElementById("categoryFilters");

    let filtersHTML = `
            <button class="btn btn-primary btn-sm filter-btn active" data-categoria="todos">
                Todos
            </button>
        `;

    categorias.forEach((categoria) => {
      filtersHTML += `
                <button class="btn btn-outline-primary btn-sm filter-btn" data-categoria="${categoria}">
                    ${categoria}
                </button>
            `;
    });

    container.innerHTML = filtersHTML;
  }

  renderProductos() {
    const container = document.getElementById("productGrid");
    const noProducts = document.getElementById("noProducts");
    const countElement = document.getElementById("currentCount");

    if (this.productosFiltrados.length === 0) {
      container.classList.add("d-none");
      noProducts.classList.remove("d-none");
      countElement.textContent = "0";
      return;
    }

    noProducts.classList.add("d-none");
    container.classList.remove("d-none");
    countElement.textContent = this.productosFiltrados.length;

    container.innerHTML = this.productosFiltrados
      .map(
        (producto) => `
            <div class="col-lg-3 col-md-4 col-sm-6">
                <div class="card product-card h-100">
                    <div class="aspect-square bg-light d-flex align-items-center justify-content-center">
                        ${
                          producto.imagen_url
                            ? `<img src="${producto.imagen_url}" alt="${producto.nombre}" class="card-img-top" style="width: 100%; height: 100%; object-fit: cover;">`
                            : `<i class="fas fa-image text-muted" style="font-size: 3rem;"></i>`
                        }
                    </div>
                    
                    <div class="card-body d-flex flex-column">
                        <div class="mb-2">
                            ${
                              producto.categoria
                                ? `<span class="badge bg-primary">${producto.categoria}</span>`
                                : ""
                            }
                        </div>
                        
                        <h6 class="card-title">${producto.nombre}</h6>
                        
                        ${
                          producto.descripcion
                            ? `<p class="card-text text-muted small">${producto.descripcion}</p>`
                            : ""
                        }
                        
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="h5 text-primary mb-0">
                                $${parseFloat(producto.precio).toLocaleString(
                                  "es-AR",
                                  { minimumFractionDigits: 2 }
                                )}
                            </span>
                            
                            <small class="text-${
                              producto.stock > 0 ? "success" : "danger"
                            }">
                                <i class="fas fa-box me-1"></i>
                                ${
                                  producto.stock > 0
                                    ? `${producto.stock} disponibles`
                                    : "Sin stock"
                                }
                            </small>
                        </div>
                        
                        <button 
                            onclick="tienda.agregarAlCarrito(${producto.id})"
                            class="btn ${
                              producto.stock > 0
                                ? "btn-primary"
                                : "btn-secondary"
                            } mt-auto"
                            ${producto.stock > 0 ? "" : "disabled"}
                        >
                            <i class="fas fa-cart-plus me-2"></i>
                            ${
                              producto.stock > 0
                                ? "Agregar al Carrito"
                                : "Sin Stock"
                            }
                        </button>
                    </div>
                </div>
            </div>
        `
      )
      .join("");
  }

  setupEventListeners() {
    // Búsqueda
    document.getElementById("searchInput").addEventListener("input", (e) => {
      this.filtrarProductos(e.target.value);
    });

    // Filtros de categoría
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("filter-btn")) {
        this.filterByCategory(e.target, e.target.dataset.categoria);
      }
    });

    // Carrito
    document.getElementById("cartButton").addEventListener("click", () => {
      this.openCart();
    });

    document.getElementById("closeCartBtn").addEventListener("click", () => {
      this.closeCart();
    });

    document.getElementById("cartOverlay").addEventListener("click", () => {
      this.closeCart();
    });

    // WhatsApp checkout
    document
      .getElementById("whatsappOrderBtn")
      .addEventListener("click", () => {
        this.iniciarCompraWhatsApp();
      });
  }

  filtrarProductos(searchTerm) {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
      this.productosFiltrados = [...this.productos];
    } else {
      this.productosFiltrados = this.productos.filter(
        (producto) =>
          producto.nombre.toLowerCase().includes(term) ||
          producto.descripcion?.toLowerCase().includes(term) ||
          producto.categoria?.toLowerCase().includes(term)
      );
    }

    this.renderProductos();
  }

  filterByCategory(button, categoria) {
    // Actualizar botones
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-outline-primary");
    });

    button.classList.remove("btn-outline-primary");
    button.classList.add("btn-primary");

    // Filtrar productos
    if (categoria === "todos") {
      this.productosFiltrados = [...this.productos];
    } else {
      this.productosFiltrados = this.productos.filter(
        (producto) => producto.categoria === categoria
      );
    }

    this.renderProductos();
  }

  agregarAlCarrito(productoId) {
    const producto = this.productos.find((p) => p.id === productoId);
    if (!producto || producto.stock === 0) return;

    const itemExistente = this.carrito.find((item) => item.id === productoId);

    if (itemExistente) {
      if (itemExistente.cantidad < producto.stock) {
        itemExistente.cantidad += 1;
      } else {
        this.showToast("No hay más stock disponible", "warning");
        return;
      }
    } else {
      this.carrito.push({
        id: producto.id,
        nombre: producto.nombre,
        precio: parseFloat(producto.precio),
        cantidad: 1,
        imagen_url: producto.imagen_url,
      });
    }

    this.saveCarrito();
    this.updateCartUI();
    this.showToast(`${producto.nombre} agregado al carrito`, "success");
  }

  updateCartUI() {
    const totalItems = this.carrito.reduce(
      (sum, item) => sum + item.cantidad,
      0
    );
    const cartCount = document.getElementById("cartCount");

    if (totalItems > 0) {
      cartCount.textContent = totalItems;
      cartCount.classList.remove("d-none");
    } else {
      cartCount.classList.add("d-none");
    }

    this.renderCartItems();
  }

  renderCartItems() {
    const container = document.getElementById("cartItems");
    const totalElement = document.getElementById("cartTotal");

    if (this.carrito.length === 0) {
      container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-shopping-cart text-muted mb-3" style="font-size: 3rem;"></i>
                    <h6 class="text-muted">Tu carrito está vacío</h6>
                </div>
            `;
      totalElement.textContent = "$0.00";
      return;
    }

    container.innerHTML = this.carrito
      .map(
        (item) => `
            <div class="card mb-3">
                <div class="card-body p-3">
                    <div class="d-flex align-items-center">
                        <div class="flex-shrink-0">
                            <div class="bg-light rounded" style="width: 50px; height: 50px;">
                                ${
                                  item.imagen_url
                                    ? `<img src="${item.imagen_url}" alt="${item.nombre}" class="rounded" style="width: 100%; height: 100%; object-fit: cover;">`
                                    : `<div class="d-flex align-items-center justify-content-center h-100">
                                        <i class="fas fa-image text-muted"></i>
                                    </div>`
                                }
                            </div>
                        </div>
                        
                        <div class="flex-grow-1 ms-3">
                            <h6 class="mb-1">${item.nombre}</h6>
                            <span class="text-primary fw-bold">$${item.precio.toLocaleString(
                              "es-AR",
                              { minimumFractionDigits: 2 }
                            )}</span>
                            
                            <div class="d-flex align-items-center justify-content-between mt-2">
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-secondary" onclick="tienda.cambiarCantidad(${
                                      item.id
                                    }, ${item.cantidad - 1})">
                                        <i class="fas fa-minus"></i>
                                    </button>
                                    <span class="btn btn-outline-secondary">${
                                      item.cantidad
                                    }</span>
                                    <button class="btn btn-outline-secondary" onclick="tienda.cambiarCantidad(${
                                      item.id
                                    }, ${item.cantidad + 1})">
                                        <i class="fas fa-plus"></i>
                                    </button>
                                </div>
                                
                                <button class="btn btn-outline-danger btn-sm" onclick="tienda.eliminarDelCarrito(${
                                  item.id
                                })">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
      )
      .join("");

    const total = this.carrito.reduce(
      (sum, item) => sum + item.precio * item.cantidad,
      0
    );
    totalElement.textContent = `$${total.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
    })}`;
  }

  cambiarCantidad(productoId, nuevaCantidad) {
    if (nuevaCantidad <= 0) {
      this.eliminarDelCarrito(productoId);
      return;
    }

    const producto = this.productos.find((p) => p.id === productoId);
    const itemCarrito = this.carrito.find((item) => item.id === productoId);

    if (!producto || !itemCarrito) return;

    if (nuevaCantidad > producto.stock) {
      this.showToast(
        `Solo hay ${producto.stock} unidades disponibles`,
        "warning"
      );
      return;
    }

    itemCarrito.cantidad = nuevaCantidad;
    this.saveCarrito();
    this.updateCartUI();
  }

  eliminarDelCarrito(productoId) {
    this.carrito = this.carrito.filter((item) => item.id !== productoId);
    this.saveCarrito();
    this.updateCartUI();
    this.showToast("Producto eliminado del carrito", "info");
  }

  openCart() {
    document.getElementById("cartSidebar").classList.add("show");
    document.getElementById("cartOverlay").classList.add("show");
    document.body.style.overflow = "hidden";
  }

  closeCart() {
    document.getElementById("cartSidebar").classList.remove("show");
    document.getElementById("cartOverlay").classList.remove("show");
    document.body.style.overflow = "auto";
  }

  iniciarCompraWhatsApp() {
    if (this.carrito.length === 0) {
      this.showToast("Tu carrito está vacío", "warning");
      return;
    }

    const mensaje = this.generarMensajeWhatsApp();
    const whatsapp = this.tiendaData.whatsapp;

    if (!whatsapp) {
      this.showToast("WhatsApp no configurado para esta tienda", "error");
      return;
    }

    const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");

    // Limpiar carrito después de enviar
    this.carrito = [];
    this.saveCarrito();
    this.updateCartUI();
    this.closeCart();

    this.showConfirmacion();
  }

  // REEMPLAZA la función generarMensajeWhatsApp() en tu tienda-dinamica.js con esta versión mejorada:

  generarMensajeWhatsApp() {
    const fecha = new Date().toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const hora = new Date().toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Usar emojis más simples y compatibles
    let mensaje = `🛒 *NUEVO PEDIDO - ${this.tiendaData.nombre.toUpperCase()}*\n`;
    mensaje += `═════════════════════════════════════\n`;
    mensaje += `📅 Fecha: ${fecha}\n`;
    mensaje += `⏰ Hora: ${hora}\n`;
    mensaje += `🌐 Tienda: ${window.location.origin}/${this.slug}\n\n`;

    // Detalles de productos
    mensaje += `📦 *DETALLE DEL PEDIDO:*\n`;
    mensaje += `─────────────────────────────────────\n`;

    let total = 0;
    this.carrito.forEach((item, index) => {
      const subtotal = item.precio * item.cantidad;
      total += subtotal;

      mensaje += `${index + 1}. *${item.nombre}*\n`;
      mensaje += `   💰 Precio: $${item.precio.toLocaleString("es-AR")}\n`;
      mensaje += `   📊 Cantidad: ${item.cantidad} unidad${
        item.cantidad > 1 ? "es" : ""
      }\n`;
      mensaje += `   💵 Subtotal: $${subtotal.toLocaleString("es-AR")}\n`;

      if (index < this.carrito.length - 1) {
        mensaje += `\n`;
      }
    });

    // Resumen total
    mensaje += `\n─────────────────────────────────────\n`;
    mensaje += `💰 *TOTAL A PAGAR: $${total.toLocaleString("es-AR")}*\n`;
    mensaje += `📋 *Total de productos: ${this.carrito.reduce(
      (sum, item) => sum + item.cantidad,
      0
    )}*\n\n`;

    // Información para completar
    mensaje += `📝 *DATOS PARA COMPLETAR:*\n`;
    mensaje += `─────────────────────────────────────\n`;
    mensaje += `👤 Nombre completo: _______________\n`;
    mensaje += `📱 Teléfono: _______________\n`;
    mensaje += `📍 Dirección de entrega: _______________\n`;
    mensaje += `💳 Forma de pago preferida: _______________\n`;
    mensaje += `🚚 Tipo de entrega: _______________\n\n`;

    // Instrucciones
    mensaje += `ℹ️ *INSTRUCCIONES:*\n`;
    mensaje += `─────────────────────────────────────\n`;
    mensaje += `✅ Completa tus datos arriba\n`;
    mensaje += `✅ Confirma el pedido\n`;
    mensaje += `✅ Te responderemos con el total final\n`;
    mensaje += `✅ Coordinaremos entrega y pago\n\n`;

    // Nota importante
    mensaje += `⚠️ *IMPORTANTE:*\n`;
    mensaje += `• Los precios pueden variar según stock\n`;
    mensaje += `• Confirmaremos disponibilidad\n`;
    mensaje += `• El pedido se reserva por 24hs\n\n`;

    // Call to action
    mensaje += `🔔 *¡Responde este mensaje para confirmar tu pedido!*\n\n`;

    // Footer
    mensaje += `═════════════════════════════════════\n`;
    mensaje += `📱 ${this.tiendaData.nombre}\n`;
    mensaje += `📞 WhatsApp: ${this.tiendaData.whatsapp}\n`;
    mensaje += `🙏 ¡Gracias por elegirnos!`;

    return mensaje;
  }

  // OPCIONAL: También puedes agregar esta función para guardar el pedido en la base de datos
  async guardarPedidoEnBD() {
    try {
      const pedidoData = {
        tienda_slug: this.slug,
        productos: this.carrito.map((item) => ({
          id: item.id,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
        })),
        total: this.carrito.reduce(
          (sum, item) => sum + item.precio * item.cantidad,
          0
        ),
        fecha_pedido: new Date().toISOString(),
        estado: "whatsapp_enviado",
      };

      // Solo guardamos localmente para tracking, no enviamos al backend
      const pedidos = JSON.parse(
        localStorage.getItem(`pedidos_${this.slug}`) || "[]"
      );
      pedidos.push(pedidoData);
      localStorage.setItem(`pedidos_${this.slug}`, JSON.stringify(pedidos));

      console.log("Pedido guardado localmente para tracking");
    } catch (error) {
      console.log("Error guardando pedido localmente:", error);
    }
  }

  // MODIFICA la función iniciarCompraWhatsApp() para incluir el guardado:
  iniciarCompraWhatsApp() {
    if (this.carrito.length === 0) {
      this.showToast("Tu carrito está vacío", "warning");
      return;
    }

    const mensaje = this.generarMensajeWhatsApp();
    const whatsapp = this.tiendaData.whatsapp;

    if (!whatsapp) {
      this.showToast("WhatsApp no configurado para esta tienda", "error");
      return;
    }

    // Guardar pedido localmente (opcional)
    this.guardarPedidoEnBD();

    const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");

    // Limpiar carrito después de enviar
    this.carrito = [];
    this.saveCarrito();
    this.updateCartUI();
    this.closeCart();

    this.showConfirmacion();
  }

  showConfirmacion() {
    const modalHTML = `
            <div class="modal fade" tabindex="-1" id="confirmacionModal">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-body text-center p-4">
                            <i class="fab fa-whatsapp text-success mb-3" style="font-size: 4rem;"></i>
                            <h4 class="mb-3">¡Pedido Enviado!</h4>
                            <p class="text-muted mb-4">
                                Tu pedido ha sido enviado por WhatsApp. 
                                En breve recibirás la confirmación.
                            </p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary w-100" data-bs-dismiss="modal">
                                Continuar Comprando
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
    const modal = new bootstrap.Modal(
      document.getElementById("confirmacionModal")
    );
    modal.show();

    // Limpiar modal al cerrar
    document
      .getElementById("confirmacionModal")
      .addEventListener("hidden.bs.modal", function () {
        this.remove();
      });
  }

  hideInitialLoading() {
    document.getElementById("initialLoading").classList.add("d-none");
    document.getElementById("mainContent").classList.remove("d-none");
  }

  showError(message) {
    document.getElementById("initialLoading").innerHTML = `
            <div class="text-center">
                <i class="fas fa-exclamation-triangle text-warning mb-3" style="font-size: 4rem;"></i>
                <h4 class="text-muted mb-3">Error</h4>
                <p class="text-muted">${message}</p>
                <button onclick="location.reload()" class="btn btn-primary">
                    <i class="fas fa-redo me-2"></i>Reintentar
                </button>
            </div>
        `;
  }

  showToast(mensaje, tipo = "info") {
    const colores = {
      success: "text-bg-success",
      error: "text-bg-danger",
      warning: "text-bg-warning",
      info: "text-bg-primary",
    };

    const toastHTML = `
            <div class="toast align-items-center ${colores[tipo]} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">${mensaje}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

    let toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.className =
        "toast-container position-fixed top-0 end-0 p-3";
      toastContainer.style.zIndex = "1060";
      document.body.appendChild(toastContainer);
    }

    toastContainer.insertAdjacentHTML("beforeend", toastHTML);
    const toastElement = toastContainer.lastElementChild;
    const toast = new bootstrap.Toast(toastElement);
    toast.show();

    toastElement.addEventListener("hidden.bs.toast", function () {
      toastElement.remove();
    });
  }
}

// Instancia global
const tienda = new TiendaDinamica();
