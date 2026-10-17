# WNPower / cPanel · actualizar a 3.1.0

## Actualización desde la versión anterior

Si ya está instalada una versión 3.0.x, para este ajuste reemplazar **server.mjs**, **storage.mjs**, **public completa** (incluido el nuevo **audio.js**) y **package.json**, y reiniciar la aplicación desde cPanel. Cambió una ruta del servidor: no alcanza con actualizar solamente public. No hace falta reiniciar la partida ni borrar las llaves elegidas. Cerrar y reabrir pantalla y controles y comprobar Versión 3.1.0. Los pasos completos siguientes también sirven para instalaciones anteriores.

1. En GitHub, descargar main con Code → Download ZIP. Descomprimir en la computadora; abrir la carpeta exterior sorteoapaib-main.
2. En cPanel → Setup Node.js App, detener la aplicación del sorteo. No tocar otros sitios.
3. Guardar una copia privada de la carpeta de código /home/apaiborgar/sorteoapaib y de los datos /home/apaiborgar/sorteoapaib-data, fuera de directorios públicos. No subir los datos a GitHub ni enviar sesiones o claves por chat.
4. Subir a /home/apaiborgar/sorteoapaib los archivos app.cjs, server.mjs, game.mjs, storage.mjs y package.json, y la carpeta public completa. Sobrescribir los archivos del código anterior. Los archivos deben quedar directamente en sorteoapaib, sin una carpeta sorteoapaib-main intermedia. Esta vez no alcanza con actualizar public: cambiaron el servidor y el guardado. public incluye el nuevo config.js y las imágenes originales.
5. Conservar las variables CONTROL_PASSWORD y DATA_DIR. No sobrescribir, eliminar ni mover sorteoapaib-data. Verificar Node.js 24.21.0, modo Production y archivo de inicio app.cjs. No hacen falta npm install ni nuevas dependencias.
6. Iniciar la aplicación. Si cPanel la muestra iniciada, pulsar Reiniciar. Si falla, consultar passenger.log.
7. Cerrar y volver a abrir las pestañas de pantalla y controles; en Windows puede hacerse Ctrl+F5. Comprobar que /control muestre Versión 3.1.0 y que /healthz devuelva ok:true y version:3.1.0. Ingresar el código de control si se solicita.
8. Solo si se actualiza desde una versión anterior a 3.0.0: tras guardar el respaldo del ensayo anterior, usar Administración → Reiniciar partida y confirmar. La versión anterior tenía otros premios: no se permite continuar una final anterior con el catálogo nuevo ni reasignar premios ya sorteados. Volver a habilitar las tarjetas entregadas y guardar.
9. En la pantalla principal, hacer clic o tocar una vez para autorizar el audio; puede aprovecharse el botón Pantalla completa. El sonido está habilitado por defecto pero el navegador necesita ese gesto local. El control en el celular no habilita el audio de la computadora. En la computadora, tocar Iniciar presentación una vez; el botón desaparecerá. En el móvil, abrir Presentación y sonido, ajustar volumen y pulsar Probar sonido en la pantalla. Si aparece Audio pausado, la prueba intenta recuperarlo; si el navegador exige un gesto local, tocar el aviso en la computadora. Comprobar volumen de Windows, salida de sonido seleccionada y equipo del salón.
10. Hacer un ensayo completo manteniendo la pantalla principal abierta. Deben registrarse exactamente cinco premios principales (TV 55, TV 40, aspiradora robot, parlante Bluetooth, smartwatch) y cinco llaves sin apertura. El botón de continuar espera a que termine la presentación en la pantalla. Comprobar apertura lenta y audio con los equipos reales. Luego reiniciar el ensayo para dejar preparada la partida del evento y volver a habilitar las tarjetas entregadas.

## Configuración de la aplicación

- Node.js: 24.21.0; modo: Production.
- Raíz: sorteoapaib; URL: sorteo.apaib.org.ar, campo de ruta vacío.
- Inicio: app.cjs; log: /home/apaiborgar/sorteoapaib/passenger.log.
- CONTROL_PASSWORD: código privado de 12–256 caracteres, ingresado únicamente en el panel.
- DATA_DIR: /home/apaiborgar/sorteoapaib-data, fuera de la raíz web.
- No fijar PORT: Passenger gestiona la escucha. La carpeta del dominio y la raíz de aplicación son diferentes; cPanel conecta ambas.

El DNS autoritativo se administra en Cloudflare. Mantener SSL válido y HTTPS para ingresar la clave. Excluir /api/* de caché. La sincronización usa peticiones cortas cada 750 ms. Esta edición permite procesos de Passenger en la misma máquina compartiendo DATA_DIR; sigue siendo suficiente un único trabajador para el evento. No distribuir la aplicación entre servidores con discos independientes.

El servidor guarda también las sesiones privadas, compartidas entre trabajadores. Un reinicio conserva las sesiones de esta versión si la clave sigue igual; cambiar la clave y reiniciar las invalida. La primera actualización desde una edición anterior puede requerir volver a ingresar el código.

El arranque de Passenger se verificó mediante su interfaz simulada y la aplicación en Chromium en desarrollo. No equivale a una validación de esta actualización en WNPower; realizar el ensayo anterior antes del evento.
