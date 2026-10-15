# APAIB - 97° Aniversario · versión 3.0.1

Aplicación de sorteo web para un evento, con pantalla proyectada y controles en el celular. El alojamiento elegido es WNPower/cPanel: ver [WNPOWER.md](WNPOWER.md), incluidos los pasos para actualizar desde versiones anteriores. No hay dependencias externas que instalar. Requiere Node.js >=22; el panel del evento usa 24.21.0.

## Operación

La pantalla está en `/` y el control en `/control`. Ingresar en el control la clave privada configurada como CONTROL_PASSWORD. El control destaca Llaves elegidas: N/10 durante la selección. El contador de intentos finales aparece solamente durante la final y al terminar; no cuenta llaves sorteadas. También muestra la versión instalada y el registro de premios.

1. Habilitar las llaves entregadas. Puede usarse Todas y desmarcar las no entregadas. Guardar selección y comenzar. Debe haber al menos diez llaves.
2. En cada uno de los cinco turnos, iniciar y detener dos selecciones consecutivas. El servidor elige uniformemente entre las llaves habilitadas, sin repetir finalistas ni ausentes. La luz es una animación independiente del resultado.
3. Confirmar presencia o marcar ausente y repetir. Los finalistas confirmados quedan amarillos con números negros.
4. Al alcanzar diez finalistas, preparar la final. Se asignan exactamente cinco aperturas y cinco llaves sin apertura, una sola vez, mediante mezcla criptográfica. Cada premio principal aparece una vez: Smart TV 55 pulgadas, Smart TV 40 pulgadas, Aspiradora Robot, Parlante Bluetooth, Smart Watch.
5. Puede acercarse cualquier finalista pendiente. Elegir su número y probar su llave. Mantener abierta la pantalla principal: esta debe terminar la presentación y confirmar su recepción. El botón Continuar permanece bloqueado hasta entonces, también en el servidor. Si queda esperando, comprobar la conexión de la pantalla principal; no abrir los controles en lugar de la pantalla.
6. Al terminar, verificar diez intentos, cinco premios principales y cinco sin apertura. El mensaje final y el registro se muestran en pantalla.
7. Para volver a empezar: Administración → Reiniciar partida → confirmar. Borra toda la partida, incluida la selección de llaves. No hacerlo durante un evento real sin intención de borrar sus resultados.

## Sonido y animación

Sonido habilitado por defecto y botón Desactivar sonido. La preferencia elegida se recuerda en ese navegador. Por restricciones del navegador, hay que tocar o hacer clic una vez en la pantalla proyectada (por ejemplo al entrar en pantalla completa) para autorizar el audio. El aviso desaparece al habilitarse. No es necesario habilitar audio en el celular de control.

Las hojas de la fotografía giran hacia adentro durante 4,8 segundos, después de un breve intento de giro de la llave. No se vuelve a crear la escena cuando llega la confirmación de recepción. El cartel ganador, los papelitos y la fanfarria de metales comienzan junto con el giro de las hojas, sin esperar a que termine la apertura. El botón Continuar sigue bloqueado hasta finalizar los 4,8 segundos del giro. El anuncio, su tamaño y los papelitos varían según el premio. Una recarga que recupera un resultado ya presentado lo reconstruye sin repetir la apertura. La apertura lenta para proyección queda habilitada por defecto, incluso si el sistema reduce animaciones. El operador puede elegir explícitamente Reducir movimiento con el botón de la pantalla; la preferencia se recuerda. Los papelitos también se suprimen en ese modo.

## Guardado e integridad

DATA_DIR debe apuntar a un directorio privado y persistente, fuera de la raíz web. La partida se guarda como game.json. El servidor lee la versión actual del archivo y serializa las modificaciones con un bloqueo entre procesos y reemplazo atómico; no usa una copia de la partida en memoria como fuente de verdad. Los bloqueos de un proceso muerto se recuperan después de cinco segundos. No compartir esta carpeta entre máquinas con sistemas de archivos independientes ni editarla durante el evento.

Las sesiones de control se guardan en archivos privados dentro de DATA_DIR/.sessions. Duran doce horas y sobreviven a un reinicio del proceso. Cambiar CONTROL_PASSWORD y reiniciar invalida las sesiones anteriores. El navegador solo recibe una cookie HttpOnly, SameSite y Secure en producción, no la clave. No publicar ni subir DATA_DIR a GitHub.

Antes de cada transición se verifican las diez asignaciones, cinco aperturas, cinco premios diferentes y correspondencia entre llave y registro. Si falta una asignación o hay una inconsistencia, se bloquea el avance con un mensaje en lugar de presentar un resultado inventado. La partida anterior no se transforma silenciosamente al catálogo nuevo: guardar respaldo y reiniciar el ensayo después de actualizar.

## Desarrollo y pruebas

```
npm test
npm start
```

Sin CONTROL_PASSWORD, el modo local genera una clave temporal y la muestra en consola. La pantalla local usa el puerto 3000 por defecto. PORT y DATA_DIR permiten aislar ensayos. En producción son obligatorios CONTROL_PASSWORD (12–256 caracteres) y DATA_DIR.

La suite incluye 500 partidas completas del modelo, asignaciones corruptas o antiguas, confirmaciones atrasadas, doble solicitud, persistencia, sesiones, cambio de clave y una partida HTTP compartida entre dos procesos. Se verificó además en Chromium una final completa desde un control de tamaño móvil: cinco aperturas y cinco sin apertura, mensajes, jerarquía de tamaños, color de llaves, apertura intermedia lenta, fanfarria generada, silencio, cartel final y reinicio.

La actualización se prueba aquí, sin operar ni reiniciar la partida del sitio real. Requiere ensayo en WNPower y en el proyector y equipo de sonido reales.

La comprobación de navegador está en `scripts/verify-browser.cjs` (`npm run test:browser`). Usa Playwright como herramienta de desarrollo opcional y un Chromium instalado: instalarlo localmente con `npm install --no-save --package-lock=false playwright` y `npx playwright install chromium`, o indicar un ejecutable ya instalado mediante CHROMIUM_PATH. No se necesita Playwright en WNPower ni para ejecutar la aplicación. La prueba crea una partida y capturas en un directorio temporal independiente; nunca opera el sitio publicado.

En 3.0.1 se verificó también el caso de ocho llaves elegidas sin intentos finales, el giro lento con la preferencia de movimiento reducido del sistema activada y el inicio simultáneo del cartel y los osciladores de la fanfarria al comenzar la apertura.
