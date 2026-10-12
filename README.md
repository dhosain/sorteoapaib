# APAIB · 97 aniversario

Para el alojamiento elegido, consultar [WNPOWER.md](WNPOWER.md). La sincronización actual usa consultas cortas cada 750 ms.

Aplicación local de sorteo, sin paquetes externos ni servicios pagos. Una computadora sirve la pantalla y los controles del celular. Es un primer prototipo: requiere ensayo y revisión visual antes del evento.

## Versión web (publicación pendiente)

La computadora abre la URL principal; el celular abre la misma URL con `/control`. Ambos se sincronizan en tiempo real. El operador ingresa el código privado configurado en el alojamiento. El público no necesita código para ver la pantalla. El código no se guarda en el navegador: el servidor crea una sesión de 12 horas mediante cookie HttpOnly, SameSite y Secure en producción. Los intentos de acceso están limitados. Un reinicio del servidor conserva la partida pero obliga a ingresar el código otra vez.

Hay una configuración de Render en `render.yaml`, pendiente de confirmar el proveedor del usuario. Requiere un servicio Node.js con una sola instancia y un disco persistente; la configuración declara un plan Starter, que puede generar cargos. No crear el servicio hasta revisar el plan y costo en la cuenta del usuario. No usar un disco efímero para la fiesta.

En Render, conectar el repositorio GitHub y crear un Blueprint desde `render.yaml`. Configurar `CONTROL_PASSWORD` con un código privado de al menos 12 caracteres en el panel seguro del proveedor; no enviarlo por chat ni guardarlo en Git. El servicio usa `DATA_DIR=/var/data/apaib`, disco de 1 GB, `npm test` como validación de construcción, `npm start` para inicio y `/healthz` para salud. Render debe terminar HTTPS y mantener las conexiones SSE; no agregar caché sobre `/events` ni `/api/*`. No escalar a más de una instancia: esta aplicación guarda un archivo local y mantiene las sesiones en memoria.

Después del despliegue, verificar pantalla y control desde dos dispositivos, hacer una partida de ensayo, reiniciar el servicio y comprobar que se recupera. Luego reiniciar la partida desde Administración. No se ha verificado un despliegue real ni HTTPS en el proveedor todavía. La URL muestra una única partida compartida; no es un servicio para múltiples eventos independientes.

## Inicio local en Windows

Instalar Node.js 24 LTS desde su sitio oficial. En esta carpeta, abrir una terminal y ejecutar:

```
npm start
```

La consola muestra un código local de seis dígitos, salvo que se configure CONTROL_PASSWORD. Para conocer la IP de la computadora, usar ipconfig en Windows. En la computadora, abrir `http://localhost:3000` para proyectar y `http://localhost:3000/control` para operar. Activar sonido con el botón de la pantalla y entrar en pantalla completa. No cerrar la terminal mientras dure el evento.

En el celular, conectado al mismo Wi-Fi, abrir `http://DIRECCION-DE-LA-COMPUTADORA:3000/control`. Ingresar el PIN. Si Windows pregunta, permitir Node.js en la red privada. Una red de invitados con aislamiento entre dispositivos puede impedir esta conexión; en ese caso operar desde la computadora o usar un router propio. Internet no es necesario para esta modalidad. No exponer el puerto a Internet: el PIN es para control en una red local de confianza, y el tráfico local usa HTTP.

## Operación

1. Habilitar solamente las llaves entregadas y guardar. Debe haber al menos diez. Comenzar bloquea esa configuración.
2. En cada uno de los cinco turnos, iniciar y detener dos selecciones consecutivas. La luz es una animación; al detener, el servidor elige de manera uniforme con un generador criptográfico.
3. Confirmar presencia para guardar el finalista. Si está ausente, excluirlo y repetir. Los ausentes se excluyen durante toda la partida. No confirmar un ausente.
4. Al alcanzar diez finalistas, preparar la final. Se asignan al azar cinco aperturas y cinco premios consuelo, una sola vez. Los premios principales son TV 55 pulgadas, robot aspiradora, parlante y dos smart watches.
5. Puede acercarse cualquier finalista pendiente. Seleccionar su número y probar su llave. Esperar la animación y entregar el premio; luego continuar. No avanzar mientras la animación esté en curso.
6. Al finalizar aparecen los resultados. Reiniciar requiere escribir REINICIAR. Para ensayar, usar una partida separada y reiniciar antes del evento.

Los datos se guardan en `.data/game.json` después de cada acción. Al reiniciar el servidor la partida continúa y el código local cambia si no se configuró CONTROL_PASSWORD. Guardar una copia de esa carpeta al finalizar si se necesita conservar el registro. No editar el archivo durante la partida. Una recarga permite reconstruir el resultado guardado; no vuelve a sortear. Las imágenes oficiales están incluidas en el repositorio.

## Diseño e imágenes

La pantalla incluye el logo oficial y la fotografía original de la fachada aportados por APAIB. Las dos hojas de la puerta usan la misma fotografía, alineada mediante CSS; se abren en perspectiva para revelar el premio sobre un interior ilustrado. No se alteraron los archivos originales. El escenario mantiene la proporción de la foto y agrega bandas cuando la pantalla tiene otra proporción. Los números se distribuyen a ambos lados de la puerta y el sonido se sintetiza en el navegador.

Se verificaron carga de imágenes, controles, selección de finalistas y apertura en Chromium. Falta el ensayo con el proyector y teléfono reales y la validación en WNPower.

## Desarrollo y validación

```
npm test
npm start
```

No hay instalación de dependencias. Node.js >=22. `PORT` cambia el puerto y `DATA_DIR` permite guardar ensayos separados, por ejemplo en PowerShell: `$env:DATA_DIR='.data-ensayo'; npm start`.

Los tests verifican exclusión de ausentes, números habilitados, ausencia de duplicados, cinco aperturas exactas, premios, orden libre y transiciones inválidas. Falta validar visualmente con navegador, proyector y teléfono reales. La autenticación y la configuración de alojamiento están preparadas. Falta desplegar y validar la URL HTTPS real en la cuenta del usuario.
