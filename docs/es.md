# Horaires Commerces — guía de uso

Esta integración trae a Gladys dos cosas de los comercios a los que va:

- su **horario**: qué comercios están abiertos, y cuándo abren o cierran;
- sus **tarjetas de fidelidad**, de cualquier marca: su código de barras en el panel,
  para escanearlo en caja desde el móvil, y su saldo.

Todo se calcula en Gladys: sin cuenta, sin contraseña. La única llamada externa va
a OpenStreetMap, para encontrar el horario de los comercios alrededor de sus casas
(ver abajo).

## Instalación

Abra **Integraciones**, busque la integración, instálela y rellene la pantalla
**Configuración**.

| Campo                             | Qué poner                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| Comercios y horario               | Sus comercios y su horario (ver abajo). Vacío si solo quiere las tarjetas.                        |
| Casas alrededor de las que buscar | Las casas de Gladys alrededor de las que buscar. Ninguna marcada: todas las que tienen ubicación. |
| Radio de búsqueda ... (km)        | A qué distancia de una casa se buscan los comercios. Por defecto: 10.                             |
| Tipos de comercios ...            | Los tipos de comercios propuestos en la pestaña Descubrimiento. Ninguno marcado: ninguno.         |
| Clave de overpass.ch              | Opcional: un servidor de OpenStreetMap más fiable (ver abajo cómo crear la clave).                |
| Aviso antes de ... (min)          | Cuándo se activan «abre pronto» / «cierra pronto». Por defecto: 30 min.                           |
| Números de tarjeta                | Sus tarjetas de fidelidad (ver abajo). Vacío si no tiene ninguna.                                 |

Pulse después **Probar la configuración**: la respuesta dice, comercio por comercio,
si está abierto, y qué tarjetas se han entendido.

Por último, abra la pestaña **Descubrimiento** de la integración y cree los
dispositivos.

### Comercios y horario

Un comercio por entrada: un nombre, y luego `=` y su horario si quiere escribirlo. Separe los comercios con `|`:

```
Leclerc = Mo-Sa 08:30-20:00; PH off | Farmacia = Mo-Fr 09:00-19:00 | Panadería = Tu-Su 07:00-13:00,15:30-19:30
```

El horario sigue la sintaxis de OpenStreetMap — a menudo ya visible en la ficha del
comercio en un mapa:

| Usted escribe                       | Significa                                           |
| ----------------------------------- | --------------------------------------------------- |
| `Mo-Sa 08:30-20:00`                 | De lunes a sábado, de 8:30 a 20:00                  |
| `Mo-Fr 08:30-12:00,14:00-19:00`     | Con pausa al mediodía                               |
| `Mo-Sa 08:30-20:00; Su 09:00-12:30` | Reglas separadas por `;`                            |
| `Mo-Sa 08:30-20:00; We 08:30-21:00` | Una regla posterior sustituye a la anterior ese día |
| `...; PH off`                       | Cerrado los festivos franceses                      |
| `...; PH 09:00-12:30`               | Horario reducido los festivos                       |
| `24/7`                              | Siempre abierto                                     |

Días en inglés: `Mo Tu We Th Fr Sa Su`. `PH` = festivos franceses (lunes de Pascua,
Ascensión y lunes de Pentecostés incluidos). Las horas se leen en hora de París. 10
comercios como máximo.

El nombre identifica el comercio: cambiarlo crea un nuevo dispositivo en Gladys.

#### Horario encontrado automáticamente

Escriba solo el nombre: `Leclerc` (o `Leclerc = auto`). La integración busca entonces
en OpenStreetMap el comercio con ese nombre más cercano a sus casas de Gladys (todas
las casas con ubicación, indicada en **Ajustes → Casas**), y toma su horario. Para
buscar otras palabras que el nombre, escríbalas tras `auto:`, por ejemplo
`Panadería = auto: Boulangerie Dupont`. Los acentos y las mayúsculas no cuentan.

- Con varias casas, gana el comercio más cercano de todas: dé un nombre preciso
  (`auto: Carrefour Market Vierzon`) para elegir uno cerca de una casa concreta.
- **Probar la configuración** indica el comercio encontrado, su localidad, su
  distancia y su horario: compruebe que es el correcto.
- El horario se busca de nuevo una vez al día, y se guarda: un reinicio sin red lo
  conserva.
- Si OpenStreetMap no tiene horario para su comercio, o uno que la integración no
  sabe leer, escríbalo a mano (y, por qué no, añádalo en openstreetmap.org).

### Comercios alrededor de sus casas (pestaña Descubrimiento)

La integración busca en OpenStreetMap, alrededor de cada casa de Gladys con ubicación
(indicada en **Ajustes → Casas**), los comercios más cercanos de los tipos marcados en
la configuración — supermercados, panaderías, farmacias, oficinas de correos, puntos
limpios… — que publican su horario. Los 3 más cercanos de cada tipo, por casa.

Abra la pestaña **Descubrimiento** de la integración: cada comercio aparece con su
casa y su distancia, por ejemplo `E.Leclerc (Casa, 1.3 km)`. Cree aquellos a los que
va, en una habitación de la casa correcta, y cámbieles el nombre como quiera:
funcionan como los comercios que escribe, y su horario se actualiza una vez al día.

### Clave de overpass.ch (opcional)

El horario se busca en servidores públicos y gratuitos de OpenStreetMap, a menudo
saturados: la búsqueda falla entonces («No se pudo contactar con OpenStreetMap») y
vuelve a intentarlo en la próxima hora. Para una búsqueda más fiable, consiga una
clave gratuita en [overpass.ch](https://overpass.ch): su servidor se consulta primero,
los públicos si falla. El plan gratuito (sin tarjeta, para uso personal) da 10 000
peticiones al mes; la integración hace una al día.

1. Abra [overpass.ch/signup](https://overpass.ch/signup) (botón **Get a free key** en
   la página de inicio).
2. Rellene **E-mail**, **Password** (10 caracteres como mínimo) y **Website** (por
   ejemplo `https://github.com/prohand/gladys-horaires-commerces`), acepte las
   condiciones y pulse **Create account** (o **Continue with Google**).
3. Abra el correo recibido y pulse el enlace de confirmación.
4. Inicie sesión (**Log in**) y abra la página de claves:
   [overpass.ch/dashboard/keys](https://overpass.ch/dashboard/keys). Cree una clave.
   **No rellene «Allowed referers» ni marque «Reject requests without a referer»**: la
   integración no envía referer, el servidor rechazaría sus peticiones (error 403
   `forbidden_referer`).
5. Copie la clave. Su dirección completa, `https://api.overpass.ch/v1/…/interpreter`,
   también sirve.
6. En Gladys: **Integraciones** → **Horaires Commerces** → **Configuración**, péguela en
   **Clave de overpass.ch** y guarde.
7. Pulse **Probar la configuración**. Los logs de la integración dicen
   `OpenStreetMap answered by api.overpass.ch` cuando la clave funciona.

La clave es personal: no la publique (foro, repositorio de código, captura de
pantalla). Una clave rechazada (403, cuota del mes agotada) no detiene nada: los
servidores públicos toman el relevo, y los logs dicen `api.overpass.ch failed (…)`.

### Tarjetas de fidelidad

Una tarjeta por entrada: un nombre (marca, titular), `=`, y el número impreso bajo el
código de barras de la tarjeta. Separe las tarjetas con `;`:

```
Leclerc Marie=2900123456785; Carrefour=2900987654327
```

Los espacios y guiones del número se ignoran; el nombre es opcional. 20 tarjetas como
máximo.

**Sobre el saldo.** Los comercios no ofrecen una API pública para sus tarjetas: un
saldo no se puede leer automáticamente sin su contraseña, mediante una interfaz no
oficial que puede dejar de funcionar en cualquier momento. La integración no lo hace.
Usted introduce el saldo — desde el widget o una escena — y Gladys lo guarda, con su
historial.

## Dispositivos

| Dispositivo   | Función                            | Notas                                            |
| ------------- | ---------------------------------- | ------------------------------------------------ |
| Cada comercio | Abierto (1 = abierto, 0 = cerrado) | Utilizable en cualquier condición de escena      |
| Cada comercio | Minutos hasta abrir o cerrar       | Actualizado cada minuto                          |
| Cada tarjeta  | Saldo (€)                          | Introducido por usted; utilizable en condiciones |

## Escenas

### Disparadores

- **Un comercio abre pronto** (`store_opening_soon`) y **Un comercio cierra pronto**
  (`store_closing_soon`): una sola vez, los minutos configurados antes. Filtro: el
  comercio (vacío = cualquiera). Variables: nombre del comercio, hora, minutos
  restantes. Ejemplo: «{{store_name}} cierra a las {{time}}, quedan {{minutes_left}}
  minutos.»

«El comercio está abierto» y «el saldo supera 10 €» son estados: use las condiciones
de dispositivo de Gladys.

### Acciones

- **¿Está abierto un comercio?** (`is_store_open`): elija un comercio. Salidas:
  _abierto_ (sí/no), la hora del próximo cambio (HH:MM) y los minutos hasta entonces.
- **Actualizar el saldo de una tarjeta** (`set_loyalty_balance`): elija una tarjeta y
  luego _fijar el saldo en_ un importe, o _sumar al saldo_ (un importe negativo para
  gastar). Salida: el nuevo saldo. Nunca baja de 0.

## Panel

- **Horario de comercios**: todos los comercios de un vistazo (abierto o cerrado,
  hasta cuándo), o — con el ajuste _Comercio_ — un comercio en detalle, con una cuenta
  atrás y el horario de hoy.
- **Tarjeta de fidelidad**: el código de barras de una tarjeta (ajuste _Tarjeta_;
  vacío = la primera), su saldo y su número, y un botón **Actualizar el saldo**.
  Muéstrelo en caja: suba el brillo del móvil para el escáner.

El código es un EAN-13 cuando el número de tarjeta lo es (13 cifras, dígito de
control válido), y un Code 128 si no. Los escáneres de caja leen ambos.

## Solución de problemas

- **La pestaña Descubrimiento está vacía**: pulse **Probar la configuración**: busca
  de nuevo en OpenStreetMap y dice por qué (casa sin ubicación, ningún tipo marcado,
  OpenStreetMap inaccesible, ningún comercio de esos tipos en el radio).
- **«No se pudo contactar con OpenStreetMap»**: los servidores públicos gratuitos
  suelen estar saturados. Ponga una clave gratuita de overpass.ch (ver **Clave de
  overpass.ch** más arriba).
- **«Ningún comercio con este nombre ... en OpenStreetMap»**: pruebe con menos
  palabras, un **Radio de búsqueda** mayor, o escriba el horario a mano.
- **«Ninguna casa de Gladys tiene ubicación»**: indique la ubicación de la casa en
  **Ajustes → Casas**.
- **«No se entiende el horario»**: el mensaje cita la parte errónea. Use los días en
  inglés (`Mo`, no `Lu`) y horas `HH:MM` (`08:30`, no `8.30`).
- **Un comercio «no se entiende»**: cada entrada debe ser `Nombre = horario`, entradas
  separadas por `|`.
- **Una tarjeta «no se entiende»**: el número debe tener de 6 a 20 cifras.
- **La caja no lee el código**: compruebe el número, suba el brillo y amplíe el
  widget. Si su tarjeta lleva otro tipo de código de barras, indíquelo en una issue.

## Datos

Los saldos se guardan en el volumen `/data` de la integración (`cards.json`) y como
estados de Gladys; nunca salen de su Gladys.

Para encontrar el horario (comercios escritos sin horario, y pestaña Descubrimiento),
las palabras buscadas, los tipos de comercios y la ubicación de sus casas (una zona
del radio de búsqueda alrededor de cada una) se envían a la API Overpass de
OpenStreetMap (primero a `api.overpass.ch` si ha puesto una clave, en Alemania; luego
`overpass-api.de`; si no responde, `overpass.private.coffee`, y luego
`maps.mail.ru`, de VK), una vez al día. El horario encontrado se guarda en
`/data/hours.json`. Para no enviar nada: escriba el horario de todos los comercios y
desmarque todos los tipos de comercios.
