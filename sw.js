/**
 * Service Worker para PWA Báscula de Minerales
 * Proporciona funcionalidad offline, cache de recursos y sincronización
 * 
 * Funcionalidades principales:
 * - Cache de recursos estáticos (HTML, CSS, JS)
 * - Funcionamiento offline completo
 * - Sincronización automática cuando vuelve la conexión
 * - Estrategias de cache optimizadas para PWA
 * 
 * @version 2.0
 * @author Sistema Báscula Minerales
 */

// Constantes de configuración del Service Worker - CON SWEETALERT2
const NOMBRE_CACHE_ESTATICO = 'bascula-minex-v2.4';
const NOMBRE_CACHE_DINAMICO = 'bascula-minex-dynamic-v2.4';
const TIEMPO_CACHE_OFFLINE = 1000 * 60 * 60 * 24; // 24 horas

/**
 * Recursos críticos que se deben cachear inmediatamente
 * Estos archivos son esenciales para el funcionamiento offline
 */
const RECURSOS_CRITICOS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/pouchdbService.js',
    './manifest.json',
    './img/logo-minex.png',
    './img/logo-minex-192.png',
    './img/logo-minex-512.png',
    './img/screenshot-mobile.svg',
    // CDNs externos críticos
    'https://cdn.jsdelivr.net/npm/pouchdb@7.3.1/dist/pouchdb.min.js',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11'
];

/**
 * Patrones de URLs que NO deben ser cacheados
 * Incluye APIs externas y recursos dinámicos
 */
const URLS_NO_CACHEAR = [
    /chrome-extension/,
    /extension/,
    /_couch/,
    /pouchdb/
];

/**
 * Evento de instalación del Service Worker
 * Se ejecuta cuando se instala por primera vez o se actualiza
 */
self.addEventListener('install', evento => {
    console.log('[SW] Instalando Service Worker v2.0');
    
    evento.waitUntil(
        caches.open(NOMBRE_CACHE_ESTATICO)
            .then(cache => {
                console.log('[SW] Cacheando recursos críticos');
                return cache.addAll(RECURSOS_CRITICOS);
            })
            .then(() => {
                console.log('[SW] Recursos críticos cacheados exitosamente');
                // Forzar activación inmediata del nuevo SW
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[SW] Error al cachear recursos críticos:', error);
            })
    );
});

/**
 * Evento de activación del Service Worker
 * Limpia caches antiguos y toma control de todas las pestañas
 */
self.addEventListener('activate', evento => {
    console.log('[SW] Activando Service Worker v2.0');
    
    evento.waitUntil(
        Promise.all([
            // Limpiar caches antiguos
            limpiarCachesAntiguos(),
            // Tomar control inmediato de todas las pestañas
            self.clients.claim()
        ]).then(() => {
            console.log('[SW] Service Worker activado y controlando todas las pestañas');
        })
    );
});

/**
 * Intercepta todas las peticiones de red
 * Implementa estrategias de cache para funcionamiento offline
 */
self.addEventListener('fetch', evento => {
    const url = new URL(evento.request.url);
    
    // Ignorar URLs que no deben ser cacheadas
    if (debeIgnorarURL(url)) {
        return;
    }
    
    // Estrategia diferente según el tipo de recurso
    if (esRecursoEstatico(evento.request)) {
        evento.respondWith(estrategiaCacheFirst(evento.request));
    } else {
        evento.respondWith(estrategiaNetworkFirst(evento.request));
    }
});

/**
 * Limpia caches antiguos para liberar espacio
 * @returns {Promise} Promesa que se resuelve cuando se completa la limpieza
 */
async function limpiarCachesAntiguos() {
    const nombresCache = await caches.keys();
    const cachesAEliminar = nombresCache.filter(nombre => 
        nombre !== NOMBRE_CACHE_ESTATICO && 
        nombre !== NOMBRE_CACHE_DINAMICO
    );
    
    const promesasEliminacion = cachesAEliminar.map(nombre => {
        console.log('[SW] Eliminando cache antiguo:', nombre);
        return caches.delete(nombre);
    });
    
    return Promise.all(promesasEliminacion);
}

/**
 * Verifica si una URL debe ser ignorada por el cache
 * @param {URL} url - URL a verificar
 * @returns {boolean} True si debe ser ignorada
 */
function debeIgnorarURL(url) {
    return URLS_NO_CACHEAR.some(patron => patron.test(url.href));
}

/**
 * Determina si una petición es de un recurso estático
 * @param {Request} request - Petición a evaluar
 * @returns {boolean} True si es un recurso estático
 */
function esRecursoEstatico(request) {
    return request.destination === 'style' ||
           request.destination === 'script' ||
           request.destination === 'image' ||
           request.destination === 'font' ||
           request.url.includes('.css') ||
           request.url.includes('.js') ||
           request.url.includes('.png') ||
           request.url.includes('.jpg') ||
           request.url.includes('.ico');
}

/**
 * Estrategia Cache First: Busca primero en cache, luego en red
 * Ideal para recursos estáticos que no cambian frecuentemente
 * @param {Request} request - Petición a procesar
 * @returns {Promise<Response>} Respuesta del cache o red
 */
async function estrategiaCacheFirst(request) {
    try {
        // Buscar primero en cache
        const respuestaCache = await caches.match(request);
        if (respuestaCache) {
            return respuestaCache;
        }
        
        // Si no está en cache, buscar en red y guardar
        const respuestaRed = await fetch(request);
        if (respuestaRed.ok) {
            const cache = await caches.open(NOMBRE_CACHE_ESTATICO);
            cache.put(request, respuestaRed.clone());
        }
        
        return respuestaRed;
    } catch (error) {
        console.error('[SW] Error en estrategia Cache First:', error);
        return new Response('Recurso no disponible offline', { status: 503 });
    }
}

/**
 * Estrategia Network First: Busca primero en red, luego en cache
 * Ideal para contenido dinámico que debe estar actualizado
 * @param {Request} request - Petición a procesar
 * @returns {Promise<Response>} Respuesta de la red o cache
 */
async function estrategiaNetworkFirst(request) {
    try {
        // Intentar primero la red con timeout
        const respuestaRed = await Promise.race([
            fetch(request),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 3000)
            )
        ]);
        
        if (respuestaRed.ok) {
            // Guardar en cache dinámico para uso offline
            const cache = await caches.open(NOMBRE_CACHE_DINAMICO);
            cache.put(request, respuestaRed.clone());
        }
        
        return respuestaRed;
    } catch (error) {
        console.log('[SW] Red no disponible, buscando en cache:', error.message);
        
        // Si falla la red, buscar en cache
        const respuestaCache = await caches.match(request);
        if (respuestaCache) {
            return respuestaCache;
        }
        
        // Si tampoco está en cache, devolver página offline
        return new Response(
            JSON.stringify({ 
                error: 'No hay conexión a internet',
                mensaje: 'Esta función requiere conexión a internet',
                offline: true 
            }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

