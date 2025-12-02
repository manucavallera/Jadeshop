// Configuración de la API
const API_BASE_URL = "http://localhost:3000/api";

// Variables globales
let productos = [];
let productosFiltrados = [];
let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

// Elementos del DOM
const loadingElement = document.getElementById("loading");
const productGrid = document.getElementById("productGrid");
const noProductsElement = document.getElementById("noProducts");
const cartModal = document.getElementById("cartModal");
const cartButton = document.getElementById("cartButton");
const searchInput = document.getElementById("searchInput");
const cartCount = document.getElementById("cartCount");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const currentCount = document.getElementById("currentCount");

// Inicializar la aplicación
document.addEventListener("DOMContentLoaded", function () {
  cargarProductos();
  actualizarContadorCarrito();

  // Event listeners
  cartButton.addEventListener("click", abrirCarrito);
  searchInput.addEventListener("input", buscarProductos);

  // Cerrar modal al hacer clic fuera
  cartModal.addEventListener("click", function (e) {
    if (e.target === cartModal) {
      cerrarCarrito();
    }
  });
});

// Cargar productos desde la API
async function cargarProductos() {
  try {
    loadingElement.classList.remove("hidden");
    productGrid.classList.add("hidden");

    const response = await fetch(`${API_BASE_URL}/productos`);
    const data = await response.json();

    if (data.success) {
      productos = data.data;
      productosFiltrados = [...productos];
      mostrarProductos(productosFiltrados);
    } else {
      throw new Error(data.message || "Error cargando productos");
    }
  } catch (error) {
    console.error("Error:", error);
    mostrarError("Error cargando los productos. Por favor, intenta de nuevo.");
  } finally {
    loadingElement.classList.add("hidden");
    productGrid.classList.remove("hidden");
  }
}

// Mostrar productos en la grilla
function mostrarProductos(productosAMostrar) {
  if (productosAMostrar.length === 0) {
    productGrid.innerHTML = "";
    noProductsElement.classList.remove("hidden");
    currentCount.textContent = "0";
    return;
  }

  noProductsElement.classList.add("hidden");
  currentCount.textContent = productosAMostrar.length;

  productGrid.innerHTML = productosAMostrar
    .map(
      (producto) => `
        <div class="bg-white rounded-lg shadow-md hover:shadow-xl transition duration-300 overflow-hidden product-card" data-categoria="${
          producto.categoria
        }">
            <!-- Imagen del producto -->
            <div class="aspect-square bg-gray-100 flex items-center justify-center">
                ${
                  producto.imagen_url
                    ? `<img src="${producto.imagen_url}" alt="${producto.nombre}" class="w-full h-full object-cover">`
                    : `<i class="fas fa-image text-4xl text-gray-300"></i>`
                }
            </div>
            
            <!-- Información del producto -->
            <div class="p-4">
                <div class="mb-2">
                    <span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        ${producto.categoria || "Sin categoría"}
                    </span>
                    ${
                      producto.codigo
                        ? `<span class="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full ml-1">
                            ${producto.codigo}
                        </span>`
                        : ""
                    }
                </div>
                
                <h3 class="font-semibold text-gray-900 mb-2 line-clamp-2">
                    ${producto.nombre}
                </h3>
                
                ${
                  producto.descripcion
                    ? `<p class="text-gray-600 text-sm mb-3 line-clamp-2">
                        ${producto.descripcion}
                    </p>`
                    : ""
                }
                
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <span class="text-2xl font-bold text-primary">
                            $${parseFloat(producto.precio).toLocaleString(
                              "es-AR",
                              { minimumFractionDigits: 2 }
                            )}
                        </span>
                    </div>
                    
                    <div class="text-right">
                        <div class="flex items-center">
                            <i class="fas fa-box text-gray-400 text-sm mr-1"></i>
                            <span class="text-sm ${
                              producto.stock > 0
                                ? "text-green-600"
                                : "text-red-600"
                            }">
                                ${
                                  producto.stock > 0
                                    ? `${producto.stock} disponibles`
                                    : "Sin stock"
                                }
                            </span>
                        </div>
                    </div>
                </div>
                
                <!-- Botón agregar al carrito -->
               <button data-producto-id="${
                 producto.id
               }" class="btn-agregar-carrito w-full py-2 px-4 rounded-lg font-medium transition duration-300 ${
        producto.stock > 0
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : "bg-gray-300 text-gray-500 cursor-not-allowed"
      }" ${producto.stock > 0 ? "" : "disabled"}
>
                    <i class="fas fa-cart-plus mr-2"></i>
                    ${producto.stock > 0 ? "Agregar al Carrito" : "Sin Stock"}
                </button>
            </div>
        </div>
    `
    )
    .join("");
}

// Filtrar productos por categoría
function filtrarPorCategoria(categoria) {
  // Actualizar botones de filtro
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.remove("active", "bg-primary", "text-white");
    btn.classList.add("bg-gray-100", "text-gray-700", "hover:bg-gray-200");
  });

  event.target.classList.add("active", "bg-primary", "text-white");
  event.target.classList.remove(
    "bg-gray-100",
    "text-gray-700",
    "hover:bg-gray-200"
  );

  // Filtrar productos
  if (categoria === "todos") {
    productosFiltrados = [...productos];
  } else {
    productosFiltrados = productos.filter(
      (producto) => producto.categoria === categoria
    );
  }

  // Aplicar búsqueda si hay texto
  const searchTerm = searchInput.value.trim();
  if (searchTerm) {
    buscarEnProductosFiltrados(searchTerm);
  } else {
    mostrarProductos(productosFiltrados);
  }
}

// Buscar productos
function buscarProductos() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  buscarEnProductosFiltrados(searchTerm);
}

function buscarEnProductosFiltrados(searchTerm) {
  if (!searchTerm) {
    mostrarProductos(productosFiltrados);
    return;
  }

  const productosEncontrados = productosFiltrados.filter(
    (producto) =>
      producto.nombre.toLowerCase().includes(searchTerm) ||
      producto.descripcion?.toLowerCase().includes(searchTerm) ||
      producto.codigo?.toLowerCase().includes(searchTerm) ||
      producto.categoria?.toLowerCase().includes(searchTerm)
  );

  mostrarProductos(productosEncontrados);
}

// Agregar producto al carrito
function agregarAlCarrito(productoId) {
  const producto = productos.find((p) => p.id === productoId);
  if (!producto || producto.stock === 0) return;

  const itemExistente = carrito.find((item) => item.id === productoId);

  if (itemExistente) {
    if (itemExistente.cantidad < producto.stock) {
      itemExistente.cantidad += 1;
    } else {
      mostrarNotificacion("No hay más stock disponible", "warning");
      return;
    }
  } else {
    carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: parseFloat(producto.precio),
      cantidad: 1,
      imagen_url: producto.imagen_url,
      codigo: producto.codigo,
    });
  }

  localStorage.setItem("carrito", JSON.stringify(carrito));
  actualizarContadorCarrito();
  mostrarNotificacion(`${producto.nombre} agregado al carrito`, "success");
}

// Actualizar contador del carrito
function actualizarContadorCarrito() {
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);

  if (totalItems > 0) {
    cartCount.textContent = totalItems;
    cartCount.classList.remove("hidden");
  } else {
    cartCount.classList.add("hidden");
  }
}

// Abrir modal del carrito
function abrirCarrito() {
  actualizarVistaCarrito();
  cartModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

// Cerrar modal del carrito
function cerrarCarrito() {
  cartModal.classList.add("hidden");
  document.body.style.overflow = "auto";
}

// Actualizar vista del carrito
function actualizarVistaCarrito() {
  if (carrito.length === 0) {
    cartItems.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-shopping-cart text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">Tu carrito está vacío</p>
                <button onclick="cerrarCarrito()" class="mt-4 text-primary hover:underline">
                    Seguir comprando
                </button>
            </div>
        `;
    cartTotal.textContent = "$0.00";
    return;
  }

  cartItems.innerHTML = carrito
    .map(
      (item) => `
        <div class="flex items-center gap-4 py-4 border-b">
            <div class="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                ${
                  item.imagen_url
                    ? `<img src="${item.imagen_url}" alt="${item.nombre}" class="w-full h-full object-cover rounded-lg">`
                    : `<i class="fas fa-image text-gray-400"></i>`
                }
            </div>
            
            <div class="flex-1">
                <h4 class="font-medium text-gray-900">${item.nombre}</h4>
                ${
                  item.codigo
                    ? `<p class="text-sm text-gray-500">${item.codigo}</p>`
                    : ""
                }
                <p class="text-primary font-semibold">$${item.precio.toLocaleString(
                  "es-AR",
                  { minimumFractionDigits: 2 }
                )}</p>
                
                <div class="flex items-center gap-2 mt-2">
                    <button onclick="cambiarCantidad(${item.id}, ${
        item.cantidad - 1
      })" class="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                        <i class="fas fa-minus text-xs"></i>
                    </button>
                    <span class="w-8 text-center font-medium">${
                      item.cantidad
                    }</span>
                    <button onclick="cambiarCantidad(${item.id}, ${
        item.cantidad + 1
      })" class="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                        <i class="fas fa-plus text-xs"></i>
                    </button>
                    <button onclick="eliminarDelCarrito(${
                      item.id
                    })" class="ml-2 text-red-500 hover:text-red-700">
                        <i class="fas fa-trash text-sm"></i>
                    </button>
                </div>
            </div>
        </div>
    `
    )
    .join("");

  const total = carrito.reduce(
    (sum, item) => sum + item.precio * item.cantidad,
    0
  );
  cartTotal.textContent = `${total.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
  })}`;
}

// Cambiar cantidad de producto en carrito
function cambiarCantidad(productoId, nuevaCantidad) {
  if (nuevaCantidad <= 0) {
    eliminarDelCarrito(productoId);
    return;
  }

  const producto = productos.find((p) => p.id === productoId);
  const itemCarrito = carrito.find((item) => item.id === productoId);

  if (!producto || !itemCarrito) return;

  if (nuevaCantidad > producto.stock) {
    mostrarNotificacion(
      `Solo hay ${producto.stock} unidades disponibles`,
      "warning"
    );
    return;
  }

  itemCarrito.cantidad = nuevaCantidad;
  localStorage.setItem("carrito", JSON.stringify(carrito));
  actualizarContadorCarrito();
  actualizarVistaCarrito();
}

// Eliminar producto del carrito
function eliminarDelCarrito(productoId) {
  carrito = carrito.filter((item) => item.id !== productoId);
  localStorage.setItem("carrito", JSON.stringify(carrito));
  actualizarContadorCarrito();
  actualizarVistaCarrito();
  mostrarNotificacion("Producto eliminado del carrito", "info");
}

// Confirmar pedido (integración con Jade Bro)
async function confirmarPedido() {
  if (carrito.length === 0) {
    mostrarNotificacion("Tu carrito está vacío", "warning");
    return;
  }

  // Solicitar datos del cliente
  const clienteData = await solicitarDatosCliente();
  if (!clienteData) return; // Usuario canceló

  try {
    const pedidoData = {
      cliente_telefono: clienteData.telefono,
      cliente_nombre: clienteData.nombre,
      cliente_direccion: clienteData.direccion,
      productos: carrito,
      subtotal: carrito.reduce(
        (sum, item) => sum + item.precio * item.cantidad,
        0
      ),
      envio: 0, // Por ahora sin costo de envío
      total: carrito.reduce(
        (sum, item) => sum + item.precio * item.cantidad,
        0
      ),
      metodo_pago: clienteData.metodoPago || "Por coordinar",
      notas: clienteData.notas || "",
    };

    // Enviar pedido al backend
    const response = await fetch(`${API_BASE_URL}/pedidos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pedidoData),
    });

    const result = await response.json();

    if (result.success) {
      // Limpiar carrito
      carrito = [];
      localStorage.removeItem("carrito");
      actualizarContadorCarrito();
      cerrarCarrito();

      // Mostrar confirmación
      mostrarConfirmacionPedido(result.data);
    } else {
      throw new Error(result.message || "Error procesando el pedido");
    }
  } catch (error) {
    console.error("Error:", error);
    mostrarNotificacion(
      "Error procesando el pedido. Intenta de nuevo.",
      "error"
    );
  }
}

// Solicitar datos del cliente
function solicitarDatosCliente() {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className =
      "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4";
    modal.innerHTML = `
            <div class="bg-white rounded-lg max-w-md w-full p-6">
                <h3 class="text-lg font-semibold mb-4">Datos de Envío</h3>
                
                <form id="clienteForm">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Teléfono (WhatsApp) *
                        </label>
                        <input type="tel" id="telefono" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="+54 9 11 1234-5678" required>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Nombre completo *
                        </label>
                        <input type="text" id="nombre" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" required>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Dirección de entrega *
                        </label>
                        <textarea id="direccion" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Calle, número, piso, depto, localidad" required></textarea>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Método de pago preferido
                        </label>
                        <select id="metodoPago" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
                            <option value="Efectivo">Efectivo</option>
                            <option value="Transferencia">Transferencia bancaria</option>
                            <option value="MercadoPago">MercadoPago</option>
                            <option value="Por coordinar">Por coordinar</option>
                        </select>
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Notas adicionales
                        </label>
                        <textarea id="notas" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Instrucciones especiales, horarios preferidos, etc."></textarea>
                    </div>
                    
                    <div class="flex gap-3">
                        <button type="button" onclick="this.closest('.fixed').remove(); resolve(null);" class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition duration-300">
                            Cancelar
                        </button>
                        <button type="submit" class="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition duration-300">
                            Confirmar Pedido
                        </button>
                    </div>
                </form>
            </div>
        `;

    document.body.appendChild(modal);

    const form = modal.querySelector("#clienteForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const telefono = document.getElementById("telefono").value.trim();
      const nombre = document.getElementById("nombre").value.trim();
      const direccion = document.getElementById("direccion").value.trim();
      const metodoPago = document.getElementById("metodoPago").value;
      const notas = document.getElementById("notas").value.trim();

      if (!telefono || !nombre || !direccion) {
        mostrarNotificacion(
          "Por favor completa todos los campos obligatorios",
          "warning"
        );
        return;
      }

      modal.remove();
      resolve({
        telefono,
        nombre,
        direccion,
        metodoPago,
        notas,
      });
    });
  });
}

// Mostrar confirmación de pedido
function mostrarConfirmacionPedido(pedido) {
  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4";
  modal.innerHTML = `
        <div class="bg-white rounded-lg max-w-md w-full p-6 text-center">
            <div class="mb-4">
                <i class="fas fa-check-circle text-green-500 text-5xl mb-4"></i>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">
                    ¡Pedido Confirmado!
                </h3>
                <p class="text-gray-600">
                    Tu pedido <strong>${pedido.codigo_pedido}</strong> ha sido recibido
                </p>
            </div>
            
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div class="flex items-center justify-center mb-2">
                    <i class="fab fa-whatsapp text-green-600 text-2xl mr-2"></i>
                    <span class="font-medium text-green-800">Te contactaremos por WhatsApp</span>
                </div>
                <p class="text-sm text-green-700">
                    En unos minutos recibirás un mensaje con los detalles de tu pedido y coordinación de entrega.
                </p>
            </div>
            
            <div class="text-left mb-6">
                <h4 class="font-medium mb-2">Resumen del pedido:</h4>
                <p class="text-sm text-gray-600">Total: <span class="font-semibold">${pedido.total}</span></p>
                <p class="text-sm text-gray-600">Estado: <span class="font-semibold">Pendiente confirmación</span></p>
            </div>
            
            <button onclick="this.closest('.fixed').remove(); window.location.reload();" class="w-full bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition duration-300">
                Continuar Comprando
            </button>
        </div>
    `;

  document.body.appendChild(modal);
}

// Mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = "info") {
  const colores = {
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
  };

  const notificacion = document.createElement("div");
  notificacion.className = `fixed top-4 right-4 ${colores[tipo]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300`;
  notificacion.innerHTML = `
        <div class="flex items-center">
            <span>${mensaje}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

  document.body.appendChild(notificacion);

  // Mostrar notificación
  setTimeout(() => {
    notificacion.style.transform = "translateX(0)";
  }, 100);

  // Auto-ocultar después de 5 segundos
  setTimeout(() => {
    notificacion.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (notificacion.parentElement) {
        notificacion.remove();
      }
    }, 300);
  }, 5000);
}

// Mostrar errores
function mostrarError(mensaje) {
  productGrid.innerHTML = `
        <div class="col-span-full text-center py-20">
            <i class="fas fa-exclamation-triangle text-4xl text-red-300 mb-4"></i>
            <h3 class="text-xl font-semibold text-gray-700 mb-2">Error</h3>
            <p class="text-gray-500 mb-4">${mensaje}</p>
            <button onclick="cargarProductos()" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition duration-300">
                Reintentar
            </button>
        </div>
    `;
}

// Agregar después de los otros event listeners
document.addEventListener("click", function (e) {
  if (e.target.classList.contains("btn-agregar-carrito")) {
    const productoId = parseInt(e.target.dataset.productoId);
    agregarAlCarrito(productoId);
  }
});
