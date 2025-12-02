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
const cartSidebar = document.getElementById("cartSidebar");
const cartOverlay = document.getElementById("cartOverlay");
const cartButton = document.getElementById("cartButton");
const closeCartBtn = document.getElementById("closeCartBtn");
const searchInput = document.getElementById("searchInput");
const cartCount = document.getElementById("cartCount");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const currentCount = document.getElementById("currentCount");
const confirmOrderBtn = document.getElementById("confirmOrderBtn");

// Inicializar la aplicación
document.addEventListener("DOMContentLoaded", function () {
    cargarProductos();
    actualizarContadorCarrito();

    // Event listeners
    cartButton.addEventListener("click", abrirCarrito);
    closeCartBtn.addEventListener("click", cerrarCarrito);
    cartOverlay.addEventListener("click", cerrarCarrito);
    searchInput.addEventListener("input", buscarProductos);
    confirmOrderBtn.addEventListener("click", confirmarPedido);

    // Event delegation para elementos dinámicos
    document.addEventListener("click", function (e) {
        // Filtros de categoría
        if (e.target.classList.contains("filter-btn")) {
            const categoria = e.target.dataset.categoria;
            filtrarPorCategoria(e.target, categoria);
        }
        
        // Botones agregar al carrito
        if (e.target.classList.contains("btn-agregar-carrito")) {
            const productoId = parseInt(e.target.dataset.productoId);
            agregarAlCarrito(productoId);
        }
        
        // Botones del carrito
        if (e.target.classList.contains("btn-cantidad-menos")) {
            const productoId = parseInt(e.target.dataset.productoId);
            const cantidadActual = parseInt(e.target.parentElement.querySelector('.cantidad-display').textContent);
            cambiarCantidad(productoId, cantidadActual - 1);
        }
        
        if (e.target.classList.contains("btn-cantidad-mas")) {
            const productoId = parseInt(e.target.dataset.productoId);
            const cantidadActual = parseInt(e.target.parentElement.querySelector('.cantidad-display').textContent);
            cambiarCantidad(productoId, cantidadActual + 1);
        }
        
        if (e.target.classList.contains("btn-eliminar-producto")) {
            const productoId = parseInt(e.target.dataset.productoId);
            eliminarDelCarrito(productoId);
        }
    });
});

// Cargar productos desde la API
async function cargarProductos() {
    try {
        loadingElement.classList.remove("d-none");
        productGrid.classList.add("d-none");

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
        loadingElement.classList.add("d-none");
        productGrid.classList.remove("d-none");
    }
}

// Mostrar productos en la grilla
function mostrarProductos(productosAMostrar) {
    if (productosAMostrar.length === 0) {
        productGrid.innerHTML = "";
        noProductsElement.classList.remove("d-none");
        currentCount.textContent = "0";
        return;
    }

    noProductsElement.classList.add("d-none");
    currentCount.textContent = productosAMostrar.length;

    productGrid.innerHTML = productosAMostrar.map(producto => `
        <div class="col-lg-3 col-md-4 col-sm-6">
            <div class="card product-card h-100" data-categoria="${producto.categoria}">
                <!-- Imagen del producto -->
                <div class="aspect-square bg-light d-flex align-items-center justify-content-center">
                    ${producto.imagen_url ? 
                        `<img src="${producto.imagen_url}" alt="${producto.nombre}" class="card-img-top" style="width: 100%; height: 100%; object-fit: cover;">` :
                        `<i class="fas fa-image text-muted" style="font-size: 3rem;"></i>`
                    }
                </div>
                
                <!-- Información del producto -->
                <div class="card-body d-flex flex-column">
                    <div class="mb-2">
                        <span class="badge bg-primary">${producto.categoria || "Sin categoría"}</span>
                        ${producto.codigo ? 
                            `<span class="badge bg-secondary ms-1">${producto.codigo}</span>` : ""
                        }
                    </div>
                    
                    <h6 class="card-title">${producto.nombre}</h6>
                    
                    ${producto.descripcion ? 
                        `<p class="card-text text-muted small">${producto.descripcion}</p>` : ""
                    }
                    
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <span class="h5 text-primary mb-0">
                                $${parseFloat(producto.precio).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                            </span>
                        </div>
                        
                        <div class="text-end">
                            <small class="d-flex align-items-center ${producto.stock > 0 ? 'text-success' : 'text-danger'}">
                                <i class="fas fa-box me-1"></i>
                                ${producto.stock > 0 ? `${producto.stock} disponibles` : 'Sin stock'}
                            </small>
                        </div>
                    </div>
                    
                    <!-- Botón agregar al carrito -->
                    <button 
                        data-producto-id="${producto.id}"
                        class="btn btn-agregar-carrito mt-auto ${producto.stock > 0 ? 'btn-primary' : 'btn-secondary'}"
                        ${producto.stock > 0 ? '' : 'disabled'}
                    >
                        <i class="fas fa-cart-plus me-2"></i>
                        ${producto.stock > 0 ? 'Agregar al Carrito' : 'Sin Stock'}
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Filtrar productos por categoría
function filtrarPorCategoria(button, categoria) {
    // Actualizar botones de filtro
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.classList.remove("btn-primary");
        btn.classList.add("btn-outline-primary");
    });
    
    button.classList.remove("btn-outline-primary");
    button.classList.add("btn-primary");

    // Filtrar productos
    if (categoria === "todos") {
        productosFiltrados = [...productos];
    } else {
        productosFiltrados = productos.filter(producto => producto.categoria === categoria);
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

    const productosEncontrados = productosFiltrados.filter(producto =>
        producto.nombre.toLowerCase().includes(searchTerm) ||
        producto.descripcion?.toLowerCase().includes(searchTerm) ||
        producto.codigo?.toLowerCase().includes(searchTerm) ||
        producto.categoria?.toLowerCase().includes(searchTerm)
    );

    mostrarProductos(productosEncontrados);
}

// Agregar producto al carrito
function agregarAlCarrito(productoId) {
    const producto = productos.find(p => p.id === productoId);
    if (!producto || producto.stock === 0) return;

    const itemExistente = carrito.find(item => item.id === productoId);

    if (itemExistente) {
        if (itemExistente.cantidad < producto.stock) {
            itemExistente.cantidad += 1;
        } else {
            mostrarToast("No hay más stock disponible", "warning");
            return;
        }
    } else {
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: parseFloat(producto.precio),
            cantidad: 1,
            imagen_url: producto.imagen_url,
            codigo: producto.codigo
        });
    }

    localStorage.setItem("carrito", JSON.stringify(carrito));
    actualizarContadorCarrito();
    actualizarVistaCarrito();
    mostrarToast(`${producto.nombre} agregado al carrito`, "success");
}

// Actualizar contador del carrito
function actualizarContadorCarrito() {
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);

    if (totalItems > 0) {
        cartCount.textContent = totalItems;
        cartCount.classList.remove("d-none");
    } else {
        cartCount.classList.add("d-none");
    }
}

// Abrir carrito
function abrirCarrito() {
    actualizarVistaCarrito();
    cartSidebar.classList.add("show");
    cartOverlay.classList.add("show");
    document.body.style.overflow = "hidden";
}

// Cerrar carrito
function cerrarCarrito() {
    cartSidebar.classList.remove("show");
    cartOverlay.classList.remove("show");
    document.body.style.overflow = "auto";
}

// Actualizar vista del carrito
function actualizarVistaCarrito() {
    if (carrito.length === 0) {
        cartItems.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-shopping-cart text-muted mb-3" style="font-size: 3rem;"></i>
                <h6 class="text-muted">Tu carrito está vacío</h6>
                <button class="btn btn-outline-primary btn-sm mt-2" onclick="cerrarCarrito()">
                    Seguir comprando
                </button>
            </div>
        `;
        cartTotal.textContent = "$0.00";
        return;
    }

    cartItems.innerHTML = carrito.map(item => `
        <div class="card mb-3">
            <div class="card-body p-3">
                <div class="d-flex align-items-center">
                    <div class="flex-shrink-0">
                        <div class="bg-light rounded" style="width: 60px; height: 60px;">
                            ${item.imagen_url ? 
                                `<img src="${item.imagen_url}" alt="${item.nombre}" class="rounded" style="width: 100%; height: 100%; object-fit: cover;">` :
                                `<div class="d-flex align-items-center justify-content-center h-100">
                                    <i class="fas fa-image text-muted"></i>
                                </div>`
                            }
                        </div>
                    </div>
                    
                    <div class="flex-grow-1 ms-3">
                        <h6 class="mb-1">${item.nombre}</h6>
                        ${item.codigo ? `<small class="text-muted">${item.codigo}</small><br>` : ''}
                        <span class="text-primary fw-bold">$${item.precio.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                        
                        <div class="d-flex align-items-center justify-content-between mt-2">
                            <div class="btn-group btn-group-sm" role="group">
                                <button class="btn btn-outline-secondary btn-cantidad-menos" data-producto-id="${item.id}">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <span class="btn btn-outline-secondary cantidad-display">${item.cantidad}</span>
                                <button class="btn btn-outline-secondary btn-cantidad-mas" data-producto-id="${item.id}">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                            
                            <button class="btn btn-outline-danger btn-sm btn-eliminar-producto" data-producto-id="${item.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    cartTotal.textContent = `$${total.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
}

// Cambiar cantidad de producto en carrito
function cambiarCantidad(productoId, nuevaCantidad) {
    if (nuevaCantidad <= 0) {
        eliminarDelCarrito(productoId);
        return;
    }

    const producto = productos.find(p => p.id === productoId);
    const itemCarrito = carrito.find(item => item.id === productoId);

    if (!producto || !itemCarrito) return;

    if (nuevaCantidad > producto.stock) {
        mostrarToast(`Solo hay ${producto.stock} unidades disponibles`, "warning");
        return;
    }

    itemCarrito.cantidad = nuevaCantidad;
    localStorage.setItem("carrito", JSON.stringify(carrito));
    actualizarContadorCarrito();
    actualizarVistaCarrito();
}

// Eliminar producto del carrito
function eliminarDelCarrito(productoId) {
    carrito = carrito.filter(item => item.id !== productoId);
    localStorage.setItem("carrito", JSON.stringify(carrito));
    actualizarContadorCarrito();
    actualizarVistaCarrito();
    mostrarToast("Producto eliminado del carrito", "info");
}

// Confirmar pedido
async function confirmarPedido() {
    if (carrito.length === 0) {
        mostrarToast("Tu carrito está vacío", "warning");
        return;
    }

    // Crear modal para datos del cliente
    const modal = new bootstrap.Modal(document.createElement('div'));
    
    const modalHTML = `
        <div class="modal fade" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Datos de Envío</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="clienteForm">
                            <div class="mb-3">
                                <label class="form-label">Teléfono (WhatsApp) *</label>
                                <input type="tel" id="telefono" class="form-control" placeholder="+54 9 11 1234-5678" required>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Nombre completo *</label>
                                <input type="text" id="nombre" class="form-control" required>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Dirección de entrega *</label>
                                <textarea id="direccion" rows="3" class="form-control" placeholder="Calle, número, piso, depto, localidad" required></textarea>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Método de pago preferido</label>
                                <select id="metodoPago" class="form-select">
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="Transferencia">Transferencia bancaria</option>
                                    <option value="MercadoPago">MercadoPago</option>
                                    <option value="Por coordinar">Por coordinar</option>
                                </select>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Notas adicionales</label>
                                <textarea id="notas" rows="2" class="form-control" placeholder="Instrucciones especiales, horarios preferidos, etc."></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="submitOrder">Confirmar Pedido</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalElement = document.body.lastElementChild;
    const modalInstance = new bootstrap.Modal(modalElement);
    modalInstance.show();
    
    // Limpiar modal al cerrar
    modalElement.addEventListener('hidden.bs.modal', function() {
        modalElement.remove();
    });
}

// Mostrar toast notifications
function mostrarToast(mensaje, tipo = "info") {
    const colores = {
        success: "text-bg-success",
        error: "text-bg-danger", 
        warning: "text-bg-warning",
        info: "text-bg-primary"
    };
    
    const toastHTML = `
        <div class="toast align-items-center ${colores[tipo]} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${mensaje}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    // Crear contenedor de toasts si no existe
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '1060';
        document.body.appendChild(toastContainer);
    }
    
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    const toastElement = toastContainer.lastElementChild;
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    
    // Limpiar toast después de ocultarse
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
}

// Mostrar errores
function mostrarError(mensaje) {
    productGrid.innerHTML = `
        <div class="col-12">
            <div class="text-center py-5">
                <i class="fas fa-exclamation-triangle text-warning mb-3" style="font-size: 4rem;"></i>
                <h4 class="text-muted mb-3">Error</h4>
                <p class="text-muted mb-4">${mensaje}</p>
                <button onclick="cargarProductos()" class="btn btn-primary">
                    <i class="fas fa-redo me-2"></i>Reintentar
                </button>
            </div>
        </div>
    `;
}.show();
    
    // Manejar envío del formulario
    modalElement.querySelector('#submitOrder').addEventListener('click', async function() {
        const telefono = document.getElementById('telefono').value.trim();
        const nombre = document.getElementById('nombre').value.trim();
        const direccion = document.getElementById('direccion').value.trim();
        const metodoPago = document.getElementById('metodoPago').value;
        const notas = document.getElementById('notas').value.trim();

        if (!telefono || !nombre || !direccion) {
            mostrarToast("Por favor completa todos los campos obligatorios", "warning");
            return;
        }

        try {
            const pedidoData = {
                cliente_telefono: telefono,
                cliente_nombre: nombre,
                cliente_direccion: direccion,
                productos: carrito,
                subtotal: carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0),
                envio: 0,
                total: carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0),
                metodo_pago: metodoPago,
                notas: notas
            };

            const response = await fetch(`${API_BASE_URL}/pedidos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(pedidoData)
            });

            const result = await response.json();

            if (result.success) {
                // Limpiar carrito
                carrito = [];
                localStorage.removeItem("carrito");
                actualizarContadorCarrito();
                cerrarCarrito();
                modalInstance.hide();
                
                // Mostrar confirmación
                mostrarConfirmacionPedido(result.data);
            } else {
                throw new Error(result.message || "Error procesando el pedido");
            }
        } catch (error) {
            console.error("Error:", error);
            mostrarToast("Error procesando el pedido. Intenta de nuevo.", "error");
        }
    });
    
    // Limpiar modal al cerrar
    modalElement.addEventListener('hidden.bs.modal', function() {
        modalElement.remove();
    });
}

// Mostrar confirmación de pedido
function mostrarConfirmacionPedido(pedido) {
    const modalHTML = `
        <div class="modal fade" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-body text-center p-4">
                        <i class="fas fa-check-circle text-success mb-3" style="font-size: 4rem;"></i>
                        <h4 class="mb-3">¡Pedido Confirmado!</h4>
                        <p class="text-muted mb-4">
                            Tu pedido <strong>${pedido.codigo_pedido}</strong> ha sido recibido
                        </p>
                        
                        <div class="alert alert-success">
                            <div class="d-flex align-items-center justify-content-center mb-2">
                                <i class="fab fa-whatsapp fs-4 me-2"></i>
                                <strong>Te contactaremos por WhatsApp</strong>
                            </div>
                            <small>
                                En unos minutos recibirás un mensaje con los detalles de tu pedido y coordinación de entrega.
                            </small>
                        </div>
                        
                        <div class="text-start">
                            <h6>Resumen del pedido:</h6>
                            <p class="mb-1">Total: <strong>$${pedido.total}</strong></p>
                            <p class="mb-0">Estado: <strong>Pendiente confirmación</strong></p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary w-100" onclick="location.reload()">
                            Continuar Comprando
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalElement = document.body.lastElementChild;
    const modalInstance = new bootstrap.Modal(modalElement);
    modalInstance.show();

// Limpiar modal al cerrar
modalElement.addEventListener('hidden.bs.modal', function() {
    modalElement.remove();
});
