// Producto Detalle - Sistema Multi-tenant
class ProductoDetalle {
  constructor() {
    this.slug = this.getSlugFromURL();
    this.productoId = this.getProductIdFromURL();
    this.tiendaData = null;
    this.producto = null;
    this.init();
  }

  extractTikTokVideoId(url) {
    if (!url) return null;

    // Para URLs completas: tiktok.com/@usuario/video/1234567890
    const match = url.match(/\/video\/(\d+)/);
    if (match) return match[1];

    // Para enlaces cortos móviles (vm.tiktok.com/ZMhKqp3Jf/)
    // No podemos extraer el ID, así que devolvemos la URL completa
    return url;
  }
  getSlugFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("slug");
  }

  getProductIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  }

  async init() {
    if (!this.productoId) {
      this.showError("Producto no especificado");
      return;
    }

    try {
      await this.loadTiendaData();
      await this.loadProducto();
      this.setupEventListeners();
      this.hideInitialLoading();
    } catch (error) {
      console.error("Error inicializando:", error);
      this.showError("Error cargando el producto");
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

      // Actualizar navbar
      document.getElementById("storeName").textContent = this.tiendaData.nombre;
      document.getElementById("backToStore").href = `/${this.slug}`;
    } catch (error) {
      console.error("Error cargando tienda:", error);
      throw error;
    }
  }

  async loadProducto() {
    try {
      const response = await fetch(
        `/api/comerciantes/${this.slug}/productos/${this.productoId}`
      );

      if (!response.ok) {
        throw new Error("Producto no encontrado");
      }

      const result = await response.json();
      this.producto = result.data;

      console.log("=== DEBUG TIKTOK ===");
      console.log("Producto completo:", this.producto);
      console.log("TikTok URL:", this.producto.tiktok_video_url);
      console.log("====================");

      this.renderProducto();
      await this.loadImageGallery(); // ← AGREGAR ESTA LÍNEA
    } catch (error) {
      console.error("Error cargando producto:", error);
      throw error;
    }
  }

  renderProducto() {
    const p = this.producto;

    // Título de página
    document.getElementById(
      "pageTitle"
    ).textContent = `${p.nombre} - ${this.tiendaData.nombre}`;

    // Categoría
    if (p.categoria) {
      document.getElementById(
        "categoryBadge"
      ).innerHTML = `<span class="badge bg-primary mb-3">${p.categoria}</span>`;
    }

    // Nombre
    document.getElementById("productName").textContent = p.nombre;

    // Imagen
    const imgElement = document.getElementById("productImage");
    if (p.imagen_url) {
      imgElement.src = p.imagen_url;
      imgElement.alt = p.nombre;
    } else {
      imgElement.src = "https://via.placeholder.com/500x500?text=Sin+Imagen";
    }

    // Precio
    this.renderPrecio();

    // Stock
    this.renderStock();

    // Descripción larga (o corta si no hay larga)
    const descripcion =
      p.descripcion_larga || p.descripcion || "Sin descripción disponible";
    document.getElementById("productDescription").textContent = descripcion;

    // AGREGAR AQUÍ EL CÓDIGO DE TIKTOK
    // Video TikTok
    if (p.tiktok_video_url) {
      const videoId = this.extractTikTokVideoId(p.tiktok_video_url);

      console.log("TikTok URL:", p.tiktok_video_url);
      console.log("Video ID extraído:", videoId);

      if (videoId) {
        const tiktokContainer = document.createElement("div");
        tiktokContainer.className = "mt-4 mb-4";
        tiktokContainer.id = "tiktok-container";

        document
          .getElementById("productDescription")
          .parentElement.appendChild(tiktokContainer);

        // Crear el embed después de agregar el contenedor al DOM
        setTimeout(() => {
          tiktokContainer.innerHTML = `
        <h5 class="mb-3">Video del Producto</h5>
        <div class="d-flex justify-content-center">
          <blockquote 
            class="tiktok-embed" 
            cite="${p.tiktok_video_url}" 
            data-video-id="${videoId}" 
            style="max-width: 605px; min-width: 325px;">
            <section>
              <a href="${p.tiktok_video_url}" target="_blank" rel="noopener">
                Ver video en TikTok
              </a>
            </section>
          </blockquote>
        </div>
      `;

          // Cargar y ejecutar script de TikTok
          const existingScript = document.querySelector(
            'script[src*="tiktok.com/embed"]'
          );
          if (existingScript) {
            existingScript.remove();
          }

          const script = document.createElement("script");
          script.src = "https://www.tiktok.com/embed.js";
          script.async = true;
          script.onload = () => {
            console.log("Script de TikTok cargado");
          };
          document.body.appendChild(script);
        }, 100);
      } else {
        console.error("No se pudo extraer el ID del video");
      }
    }

    // Botón agregar al carrito
    const addBtn = document.getElementById("addToCartBtn");
    if (p.stock > 0) {
      addBtn.disabled = false;
      addBtn.classList.remove("btn-secondary");
      addBtn.classList.add("btn-primary");
    } else {
      addBtn.disabled = true;
      addBtn.classList.remove("btn-primary");
      addBtn.classList.add("btn-secondary");
      addBtn.innerHTML = '<i class="fas fa-times me-2"></i>Sin Stock';
    }
  }

  renderPrecio() {
    const p = this.producto;
    const container = document.getElementById("priceContainer");

    if (p.precio_rebajado) {
      // Hay oferta
      container.innerHTML = `
        <div class="mb-2">
          <span class="badge bg-danger">OFERTA</span>
        </div>
        <div class="mb-2">
          <span class="text-muted text-decoration-line-through h5">
            $${parseFloat(p.precio).toLocaleString("es-AR", {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>
        <div>
          <span class="h2 text-success fw-bold mb-0">
            $${parseFloat(p.precio_rebajado).toLocaleString("es-AR", {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>
        <div class="mt-2">
          <small class="text-success">
            Ahorrás $${(
              parseFloat(p.precio) - parseFloat(p.precio_rebajado)
            ).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </small>
        </div>
      `;
    } else {
      // Precio normal
      container.innerHTML = `
        <span class="h2 text-primary fw-bold mb-0">
          $${parseFloat(p.precio).toLocaleString("es-AR", {
            minimumFractionDigits: 2,
          })}
        </span>
      `;
    }
  }

  renderStock() {
    const p = this.producto;
    const container = document.getElementById("stockInfo");

    if (p.stock > 0) {
      container.innerHTML = `
        <div class="alert alert-success">
          <i class="fas fa-check-circle me-2"></i>
          <strong>Disponible:</strong> ${p.stock} ${
        p.stock === 1 ? "unidad" : "unidades"
      }
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-times-circle me-2"></i>
          <strong>Sin stock disponible</strong>
        </div>
      `;
    }
  }

  setupEventListeners() {
    document.getElementById("addToCartBtn").addEventListener("click", () => {
      this.agregarAlCarrito();
    });
  }

  agregarAlCarrito() {
    if (this.producto.stock === 0) return;

    // Obtener carrito actual
    let carrito = JSON.parse(
      localStorage.getItem(`carrito_${this.slug}`) || "[]"
    );

    // Buscar si ya existe
    const itemExistente = carrito.find((item) => item.id === this.producto.id);

    if (itemExistente) {
      if (itemExistente.cantidad < this.producto.stock) {
        itemExistente.cantidad += 1;
      } else {
        this.showToast("No hay más stock disponible", "warning");
        return;
      }
    } else {
      carrito.push({
        id: this.producto.id,
        nombre: this.producto.nombre,
        precio: this.producto.precio_rebajado
          ? parseFloat(this.producto.precio_rebajado)
          : parseFloat(this.producto.precio),
        precio_original: parseFloat(this.producto.precio),
        precio_rebajado: this.producto.precio_rebajado
          ? parseFloat(this.producto.precio_rebajado)
          : null,
        cantidad: 1,
        imagen_url: this.producto.imagen_url,
      });
    }

    // Guardar carrito
    localStorage.setItem(`carrito_${this.slug}`, JSON.stringify(carrito));

    this.showToast("Producto agregado al carrito", "success");

    // Redirigir a la tienda después de 1 segundo
    setTimeout(() => {
      window.location.href = `/${this.slug}`;
    }, 1000);
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
        <a href="/${this.slug}" class="btn btn-primary">
          <i class="fas fa-arrow-left me-2"></i>Volver a la tienda
        </a>
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

  async loadImageGallery() {
    try {
      const response = await fetch(
        `/api/comerciantes/${this.slug}/productos/${this.productoId}/imagenes`
      );

      if (!response.ok) {
        console.log("No hay galería, usando imagen única");
        return;
      }

      const result = await response.json();
      const imagenes = result.data;

      if (!imagenes || imagenes.length === 0) {
        console.log("Galería vacía");
        return;
      }

      console.log(`✅ Galería cargada: ${imagenes.length} imágenes`);

      // Renderizar carrusel
      const carouselInner = document.getElementById("carouselImages");
      carouselInner.innerHTML = imagenes
        .map(
          (img, index) => `
        <div class="carousel-item ${index === 0 ? "active" : ""}">
          <img src="${img.imagen_url}" 
               class="product-image" 
               alt="${this.producto.nombre} - Imagen ${index + 1}">
        </div>
      `
        )
        .join("");

      // Indicadores
      if (imagenes.length > 1) {
        const indicators = document.getElementById("carouselIndicators");
        indicators.innerHTML = imagenes
          .map(
            (img, index) => `
          <button type="button" 
                  data-bs-target="#productImageCarousel" 
                  data-bs-slide-to="${index}" 
                  ${index === 0 ? 'class="active" aria-current="true"' : ""}
                  aria-label="Imagen ${index + 1}">
          </button>
        `
          )
          .join("");
      }

      // Miniaturas
      const thumbnails = document.getElementById("thumbnailsContainer");
      thumbnails.innerHTML = imagenes
        .map(
          (img, index) => `
        <div class="col-3">
          <img src="${img.imagen_url}" 
               class="img-thumbnail" 
               style="cursor: pointer; height: 80px; width: 100%; object-fit: cover;"
               onclick="bootstrap.Carousel.getInstance(document.getElementById('productImageCarousel')).to(${index})">
        </div>
      `
        )
        .join("");

      // Mostrar controles si hay más de 1 imagen
      if (imagenes.length > 1) {
        document.getElementById("carouselPrev").style.display = "block";
        document.getElementById("carouselNext").style.display = "block";
      }
    } catch (error) {
      console.error("Error cargando galería:", error);
    }
  }
}

// Inicializar
const productoDetalle = new ProductoDetalle();
