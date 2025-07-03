/**
 * Servicio de base de datos PouchDB para PWA Báscula
 * Maneja almacenamiento local y sincronización con CouchDB en red local
 * 
 * Funcionalidades:
 * - Almacenamiento offline con IndexedDB
 * - Sincronización bidireccional automática
 * - Resolución de conflictos
 * - Soporte para redes LAN sin internet
 */

// Configuración de bases de datos local y remota
let baseDatosLocal = new PouchDB('bascula_local');
// Cambia la IP aquí por la de tu servidor CouchDB en la LAN
let baseDatosRemota = new PouchDB('http://192.168.1.100:5984/bascula'); // <-- Cambia esta IP según tu red
let manejadorSincronizacion = null;
let funcionCallbackCambios = null;

/**
 * Inicia la sincronización bidireccional entre base de datos local y remota
 * Configura todos los listeners para eventos de sincronización
 * @function iniciarSincronizacion
 */
function iniciarSincronizacion() {
  if (manejadorSincronizacion) {
    manejadorSincronizacion.cancel();
  }
  
  manejadorSincronizacion = baseDatosLocal.sync(baseDatosRemota, {
    live: true,
    retry: true
  })
    .on('change', informacionCambio => {
      console.log('Cambio de sincronización:', informacionCambio);
      if (funcionCallbackCambios) funcionCallbackCambios(informacionCambio);
    })
    .on('paused', errorPausa => {
      // Replicación pausada (offline o sin cambios)
      if (errorPausa) console.warn('Sincronización pausada (error):', errorPausa);
    })
    .on('active', () => {
      // Replicación reanudada
      console.log('Sincronización activa');
    })
    .on('denied', errorDenegado => {
      console.error('Sincronización denegada:', errorDenegado);
    })
    .on('complete', informacionCompleta => {
      console.log('Sincronización completa:', informacionCompleta);
    })
    .on('error', errorSincronizacion => {
      console.error('Error de sincronización:', errorSincronizacion);
    });
}

/**
 * Permite cambiar la URL de la base de datos remota (útil para configurar redes LAN)
 * @param {string} nuevaUrl - Nueva URL de la base de datos CouchDB remota
 */
function configurarBaseDatosRemota(nuevaUrl) {
  baseDatosRemota = new PouchDB(nuevaUrl);
  iniciarSincronizacion();
}

/**
 * Permite registrar una función callback para escuchar cambios en la base de datos
 * @param {Function} funcionCallback - Función que se ejecutará cuando ocurran cambios
 */
function alCambioBD(funcionCallback) {
  funcionCallbackCambios = funcionCallback;
}

/**
 * Configura listener para cambios locales que refrescan la interfaz de usuario
 * Se ejecuta automáticamente para mantener la UI actualizada
 */
baseDatosLocal.changes({
  since: 'now',
  live: true,
  include_docs: true
}).on('change', cambio => {
  if (funcionCallbackCambios) funcionCallbackCambios(cambio);
});

// Iniciar sincronización automáticamente al cargar el servicio
iniciarSincronizacion();

/**
 * Servicio principal que expone todas las operaciones CRUD y de configuración
 * Todas las operaciones son asíncronas y manejan errores apropiadamente
 */
export const servicioBaseDatos = {
  /**
   * Crea un nuevo documento en la base de datos local
   * @param {Object} documento - Documento a crear
   * @returns {Promise<Object>} Respuesta con información del documento creado
   */
  crear: async (documento) => {
    try {
      const respuesta = await baseDatosLocal.post(documento);
      return respuesta;
    } catch (error) {
      console.error('Error al crear documento:', error);
      throw error;
    }
  },
  
  /**
   * Lee un documento específico por su ID
   * @param {string} id - ID del documento a leer
   * @returns {Promise<Object>} Documento encontrado
   */
  leer: async (id) => {
    try {
      const documento = await baseDatosLocal.get(id);
      return documento;
    } catch (error) {
      console.error('Error al leer documento:', error);
      throw error;
    }
  },
  
  /**
   * Actualiza un documento existente
   * @param {Object} documento - Documento a actualizar (debe incluir _id y _rev)
   * @returns {Promise<Object>} Respuesta con información de la actualización
   */
  actualizar: async (documento) => {
    try {
      const respuesta = await baseDatosLocal.put(documento);
      return respuesta;
    } catch (error) {
      console.error('Error al actualizar documento:', error);
      throw error;
    }
  },
  
  /**
   * Elimina un documento de la base de datos
   * @param {Object} documento - Documento a eliminar (debe incluir _id y _rev)
   * @returns {Promise<Object>} Respuesta con información de la eliminación
   */
  eliminar: async (documento) => {
    try {
      const respuesta = await baseDatosLocal.remove(documento);
      return respuesta;
    } catch (error) {
      console.error('Error al eliminar documento:', error);
      throw error;
    }
  },
  
  /**
   * Obtiene todos los documentos de la base de datos local
   * @returns {Promise<Array>} Array con todos los documentos
   */
  obtenerTodos: async () => {
    try {
      const resultado = await baseDatosLocal.allDocs({ include_docs: true });
      return resultado.rows.map(fila => fila.doc);
    } catch (error) {
      console.error('Error al obtener todos los documentos:', error);
      throw error;
    }
  },
  
  // Exportar funciones de configuración
  configurarBaseDatosRemota,
  alCambioBD
};
