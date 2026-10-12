# Publicación en WNPower / cPanel

## 1. Subir los archivos

En Administrador de archivos, entrar en la carpeta principal de la cuenta (fuera de public_html) y crear `sorteoapaib`. Subir y extraer allí el ZIP: deben quedar directamente `app.cjs`, `server.mjs`, `game.mjs`, `package.json` y la carpeta `public`. No subir datos de una partida anterior. La carpeta del dominio y la raíz de la aplicación son distintas: cPanel/Passenger conecta ambas.

## 2. Crear la aplicación Node.js

- Versión: 24.21.0.
- Modo: Production.
- Raíz: sorteoapaib.
- URL: sorteo.apaib.org.ar, campo de ruta vacío.
- Archivo de inicio: app.cjs.
- Log Passenger: /home/apaiborgar/sorteoapaib/passenger.log.

Añadir variables:

- CONTROL_PASSWORD: elegir un código privado de 12 a 256 caracteres. No enviarlo por chat.
- DATA_DIR: /home/apaiborgar/sorteoapaib-data.

La ruta de cuenta anterior proviene del panel mostrado; verificarla si cPanel muestra otra. DATA_DIR debe estar fuera de cualquier directorio web. No configurar PORT: Passenger gestiona la escucha. No hay paquetes externos que instalar. Crear la aplicación y reiniciarla tras subir los archivos.

## 3. Importante: un único proceso

La aplicación mantiene sesiones y sincronización en memoria, y la partida en un archivo. Antes de usarla, pedir a soporte que configure esta aplicación Passenger con un único proceso trabajador (PassengerMaxInstancesPerApp 1), sin otros trabajadores Node ejecutando el mismo proyecto. No configurar varios procesos o instancias: provocarían estados inconsistentes. No modificar configuraciones globales ni el sitio principal de APAIB.

La sincronización utiliza peticiones cortas cada 750 ms para evitar depender de conexiones SSE largas y del buffering del proxy. Pedir que no se cacheen las rutas de esta aplicación, especialmente /api/*. Si el proveedor necesita una regla específica para excluir el subdominio de NGINX caching, solicitarla.

## 4. Comprobar tras resolver SSL

No ingresar el código privado por HTTP. Cuando el certificado sea válido, habilitar la redirección HTTPS para este subdominio. Abrir la URL principal para la pantalla y /control en el celular. /healthz debe responder con {"ok":true}.

Hacer una partida de ensayo con al menos diez llaves. Comprobar cambios entre dos dispositivos, cinco aperturas exactas y diez intentos. Reiniciar la aplicación desde cPanel y comprobar recuperación de la partida e ingreso de código nuevamente. Reiniciar la partida desde Administración antes del evento, únicamente tras terminar el ensayo. Guardar copia privada de sorteoapaib-data si se necesita respaldo.

El paquete se validó con Node.js en el entorno de desarrollo, no contra el Passenger de WNPower. La emisión SSL, configuración de proceso único y prueba real en el alojamiento siguen pendientes. La foto y logo originales aún no están incluidos.
