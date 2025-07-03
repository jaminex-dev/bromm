/**
 * Servicio principal de la aplicación PWA Báscula
 * Maneja el registro de pesajes con sincronización offline/online
 */
import { servicioBaseDatos } from './pouchdbService.js';

/**
 * Sistema de notificaciones elegantes usando SweetAlert2
 */
const Notificaciones = {
  exito: (mensaje) => {
    Swal.fire({
      title: '¡Éxito!',
      text: mensaje,
      icon: 'success',
      timer: 3000,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  },
  
  error: (mensaje) => {
    Swal.fire({
      title: 'Error',
      text: mensaje,
      icon: 'error',
      timer: 4000,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  },
  
  advertencia: (mensaje) => {
    Swal.fire({
      title: 'Advertencia',
      text: mensaje,
      icon: 'warning',
      timer: 4000,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  },
  
  info: (mensaje) => {
    Swal.fire({
      title: 'Información',
      text: mensaje,
      icon: 'info',
      timer: 3000,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  },
  
  /**
   * Confirmar acción con modal elegante
   * @param {string} mensaje - Mensaje de confirmación
   * @param {Function} callback - Función a ejecutar si confirma
   */
  confirmar: (mensaje, callback) => {
    Swal.fire({
      title: 'Confirmar Acción',
      text: mensaje,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#1976d2',
      cancelButtonColor: '#dc3545',
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        callback();
      }
    });
  }
};

// Referencias a elementos del DOM 
const formularioPesaje = document.getElementById('form-pesaje');
const cuerpoTablaPesajes = document.getElementById('tabla-pesajes').querySelector('tbody');
const selectorProducto = document.getElementById('producto');
const campoEntradaPeso = document.getElementById('peso');
const contenedorEstadoSincronizacion = document.getElementById('sync-status');

// Estado de edición para preservar datos originales
let estadoEdicion = {
  estaEditando: false,
  documentoOriginal: null,
  filaModoEdicion: null
};

/**
 * Llena el selector de productos con datos de una API externa de minerales
 * Si la API falla, utiliza una lista local de respaldo
 * @async
 * @function poblarSelectorProductos
 */
async function poblarSelectorProductos() {
  try {
    // Intenta obtener datos de la API externa de recursos minerales
    const respuestaAPI = await fetch('https://data.opendatasoft.com/api/records/1.0/search/?dataset=mineral-resources&q=&rows=100');
    const datosRecibidos = await respuestaAPI.json();
    
    // Extrae nombres únicos de minerales y filtra valores vacíos
    const listaMinerales = Array.from(new Set(datosRecibidos.records.map(registro => registro.fields.mineral_name))).filter(Boolean);
    
    // Genera opciones HTML para el selector
    selectorProducto.innerHTML = listaMinerales.map(nombreMineral => 
      `<option value="${nombreMineral}">${nombreMineral}</option>`
    ).join('');
    
  } catch (errorAPI) {
    // Lista de respaldo cuando la API no está disponible
    const productosMineralesRespaldo = [
      'Carbón', 'Coque', 'Hulla', 'Antracita', 'Pirita', 'Cobre', 'Hierro', 'Plomo', 'Zinc', 'Estaño', 
      'Níquel', 'Manganeso', 'Bauxita', 'Magnesita', 'Yeso', 'Sal', 'Azufre', 'Baritina', 'Fluorita', 
      'Wolframio', 'Litio', 'Cuarzo', 'Feldespato', 'Caolín', 'Arcilla', 'Granito', 'Mármol', 'Caliza', 
      'Dolomita', 'Pizarra', 'Arenisca', 'Grava', 'Arena', 'Talco', 'Grafito', 'Uranio', 'Oro', 'Plata', 
      'Platino', 'Diamante'
    ];
    
    selectorProducto.innerHTML = productosMineralesRespaldo.map(nombreProducto => 
      `<option value="${nombreProducto}">${nombreProducto}</option>`
    ).join('');
  }
}

/**
 * Maneja el evento de envío del formulario para crear un nuevo registro de pesaje
 * Previene el comportamiento por defecto, captura datos y los guarda en la base de datos
 * Si está en modo edición, actualiza el registro existente en lugar de crear uno nuevo
 */
formularioPesaje.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  
  try {
    // Captura los valores del formulario
    const productoSeleccionado = selectorProducto.value;
    const pesoIngresado = campoEntradaPeso.value;
    
    // Validaciones simples
    if (!productoSeleccionado) {
      Notificaciones.error('Debe seleccionar un producto');
      return;
    }
    
    if (!pesoIngresado || pesoIngresado <= 0) {
      Notificaciones.error('Debe ingresar un peso válido mayor a 0');
      return;
    }
    
    if (pesoIngresado > 100000) {
      Notificaciones.advertencia('Peso muy alto. ¿Está seguro que es correcto?');
      // Pero permite continuar
    }
    
    if (estadoEdicion.estaEditando) {
      // Modo edición: actualiza el documento existente
      const documentoActualizado = {
        ...estadoEdicion.documentoOriginal,
        producto: productoSeleccionado,
        peso: pesoIngresado,
        fechaModificacion: new Date().toISOString()
      };
      
      await servicioBaseDatos.actualizar(documentoActualizado);
      Notificaciones.exito(`Pesaje de ${productoSeleccionado} actualizado exitosamente`);
      finalizarModoEdicion();
    } else {
      // Modo creación: crea un nuevo documento
      const datosPesaje = {
        producto: productoSeleccionado,
        peso: pesoIngresado,
        fecha: new Date().toISOString(),
        tipo: 'pesaje'
      };
      
      await servicioBaseDatos.crear(datosPesaje);
      Notificaciones.exito(`Pesaje de ${productoSeleccionado} registrado exitosamente`);
    }
    
    // Limpia el formulario y actualiza la vista
    formularioPesaje.reset();
    renderizarTablaPesajes();
    
    // Actualizar estado de sincronización
    contenedorEstadoSincronizacion.textContent = 'Guardado y sincronizado.';
    setTimeout(() => contenedorEstadoSincronizacion.textContent = '', 3000);
    
  } catch (error) {
    console.error('Error en formulario:', error);
    Notificaciones.error('Error al procesar el formulario');
  }
});

/**
 * Renderiza la tabla de pesajes obteniendo todos los documentos de la base de datos
 * Filtra solo los documentos de tipo 'pesaje' y genera las filas HTML correspondientes
 * Incluye indicadores visuales para filas en modo edición
 * @async
 * @function renderizarTablaPesajes
 */
async function renderizarTablaPesajes() {
  // Obtiene todos los documentos de la base de datos
  const todosLosDocumentos = await servicioBaseDatos.obtenerTodos();
  
  // Filtra solo los registros de pesajes
  const registrosPesajes = todosLosDocumentos.filter(documento => documento.tipo === 'pesaje');
  
  // Genera el HTML de las filas de la tabla
  cuerpoTablaPesajes.innerHTML = registrosPesajes.map(registroPesaje => {
    const estaFilaEnEdicion = estadoEdicion.estaEditando && estadoEdicion.documentoOriginal._id === registroPesaje._id;
    const claseFilaEdicion = estaFilaEnEdicion ? ' fila-editando' : '';
    
    return `<tr class="${claseFilaEdicion}">
      <td>${registroPesaje.producto}</td>
      <td>${registroPesaje.peso}</td>
      <td>${new Date(registroPesaje.fecha).toLocaleString()}</td>
      <td>
        ${estaFilaEnEdicion ? 
          `<button class="crud-btn btn-cancelar" onclick="window.cancelarEdicionRegistro()">❌ Cancelar</button>` :
          `<button class="crud-btn" onclick="window.editarRegistroPesaje('${registroPesaje._id}')">✏️</button>
           <button class="crud-btn" onclick="window.eliminarRegistroPesaje('${registroPesaje._id}', '${registroPesaje._rev}')">🗑️</button>`
        }
      </td>
    </tr>`;
  }).join('');
}

/**
 * Funciones CRUD globales para las operaciones desde los botones de la tabla
 * Se exponen en el objeto window para ser accesibles desde los eventos onclick
 */

/**
 * Elimina un registro de pesaje de la base de datos con confirmación elegante
 * @param {string} idDocumento - ID único del documento
 * @param {string} revisionDocumento - Número de revisión del documento (requerido por PouchDB)
 */
window.eliminarRegistroPesaje = async (idDocumento, revisionDocumento) => {
  try {
    // Obtener datos del registro para mostrar en la confirmación
    const registro = await servicioBaseDatos.leer(idDocumento);
    
    const mensaje = `¿Estás seguro de eliminar este pesaje?\n\n` +
                   `Producto: ${registro.producto}\n` +
                   `Peso: ${registro.peso} kg\n` +
                   `Fecha: ${new Date(registro.fecha).toLocaleString()}\n\n` +
                   `Esta acción no se puede deshacer.`;
    
    Notificaciones.confirmar(mensaje, async () => {
      try {
        await servicioBaseDatos.eliminar({_id: idDocumento, _rev: revisionDocumento});
        Notificaciones.exito('Registro eliminado exitosamente');
        renderizarTablaPesajes();
      } catch (error) {
        console.error('Error al eliminar:', error);
        Notificaciones.error('Error al eliminar el registro');
      }
    });
    
  } catch (error) {
    console.error('Error al obtener registro para eliminar:', error);
    Notificaciones.error('Error al acceder al registro');
  }
};

/**
 * Carga los datos de un registro en el formulario para editarlo
 * @param {string} idDocumento - ID único del documento a editar
 */
window.editarRegistroPesaje = async (idDocumento) => {
  try {
    // Evita editar múltiples registros al mismo tiempo
    if (estadoEdicion.estaEditando) {
      Notificaciones.advertencia('Ya hay una edición en progreso. Termina la edición actual primero.');
      return;
    }
    
    // Obtiene el documento original sin eliminarlo
    const documentoAEditar = await servicioBaseDatos.leer(idDocumento);
    
    // Establece el estado de edición
    estadoEdicion = {
      estaEditando: true,
      documentoOriginal: documentoAEditar,
      filaModoEdicion: null
    };
    
    // Carga los datos en el formulario
    selectorProducto.value = documentoAEditar.producto;
    campoEntradaPeso.value = documentoAEditar.peso;
    
    // Cambia el texto del botón de envío para indicar modo edición
    const botonEnvio = formularioPesaje.querySelector('button[type="submit"]');
    botonEnvio.textContent = 'Actualizar Pesaje';
    botonEnvio.style.backgroundColor = '#ff9800';
    
    // Agrega botón de cancelar al formulario
    if (!document.getElementById('btn-cancelar-formulario')) {
      const botonCancelar = document.createElement('button');
      botonCancelar.type = 'button';
      botonCancelar.id = 'btn-cancelar-formulario';
      botonCancelar.textContent = 'Cancelar Edición';
      botonCancelar.className = 'btn-cancelar';
      botonCancelar.onclick = cancelarEdicionRegistro;
      formularioPesaje.appendChild(botonCancelar);
    }
    
    // Actualiza la tabla para mostrar la fila en modo edición
    renderizarTablaPesajes();
    
    // Enfoca el primer campo del formulario
    selectorProducto.focus();
    
    Notificaciones.info(`Editando pesaje de ${documentoAEditar.producto}`);
    
  } catch (error) {
    console.error('Error al editar registro:', error);
    Notificaciones.error('Error al cargar los datos para edición');
  }
};

/**
 * Cancela la edición actual y restaura el estado original
 */
window.cancelarEdicionRegistro = () => {
  const productoOriginal = estadoEdicion.documentoOriginal?.producto || '';
  
  finalizarModoEdicion();
  formularioPesaje.reset();
  renderizarTablaPesajes();
  
  Notificaciones.info(`Edición de ${productoOriginal} cancelada`);
};

/**
 * Finaliza el modo de edición y restaura el estado normal del formulario
 */
function finalizarModoEdicion() {
  // Resetea el estado de edición
  estadoEdicion = {
    estaEditando: false,
    documentoOriginal: null,
    filaModoEdicion: null
  };
  
  // Restaura el botón de envío a su estado normal
  const botonEnvio = formularioPesaje.querySelector('button[type="submit"]');
  botonEnvio.textContent = 'Guardar Pesaje';
  botonEnvio.style.backgroundColor = '#1976d2';
  
  // Elimina el botón de cancelar si existe
  const botonCancelar = document.getElementById('btn-cancelar-formulario');
  if (botonCancelar) {
    botonCancelar.remove();
  }
}

/**
 * Configuración de la sincronización con CouchDB
 * Establece la conexión con la base de datos remota usando credenciales
 */
// Cambia la IP 127.0.0.1 por la IP local de tu PC para que funcione desde otros dispositivos
servicioBaseDatos.configurarBaseDatosRemota('http://admin:1234@10.1.1.134:5984/bascula');

/**
 * Inicialización de la aplicación cuando el DOM está completamente cargado
 * Configura los elementos iniciales y establece los listeners de cambios
 */
document.addEventListener('DOMContentLoaded', () => {
  poblarSelectorProductos();
  renderizarTablaPesajes();
  
  // Configura la actualización automática cuando hay cambios en la base de datos
  servicioBaseDatos.alCambioBD(renderizarTablaPesajes);
});

/**
 * Manejo de mensajes de estado de sincronización
 * Muestra retroalimentación visual al usuario sobre el estado de la conexión
 */
document.addEventListener('DOMContentLoaded', () => {
  servicioBaseDatos.alCambioBD(() => {
    contenedorEstadoSincronizacion.textContent = 'Sincronizado con la red local.';
    
    // Oculta el mensaje después de 2 segundos
    setTimeout(() => contenedorEstadoSincronizacion.textContent = '', 2000);
  });
});
