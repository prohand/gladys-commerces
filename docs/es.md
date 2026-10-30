# E.Leclerc — guía de uso

Esta integración trae a Gladys dos datos de su tienda E.Leclerc:

- los **avisos de retirada de productos**: los de RappelConso, el registro oficial
  francés, que afectan a un producto vendido en E.Leclerc;
- el **horario**: si su tienda está abierta, y cuándo abre o cierra.

Sin cuenta ni clave de API. Es una integración comunitaria: E.Leclerc no la hace,
no la revisa ni le da soporte.

## Instalación

Abra **Integraciones**, busque **E.Leclerc**, instálela y rellene la pantalla
**Configuración**.

| Campo                            | Qué poner                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| Nombre de la tienda              | El nombre del dispositivo tienda en Gladys, p. ej. `E.Leclerc Carcassonne`.             |
| Horario de apertura              | El horario de la tienda (ver abajo). Por defecto: `Mo-Sa 08:30-20:00; PH off`.          |
| Aviso antes de ... (min)         | Cuándo se activan «abre pronto» / «cierra pronto». Por defecto: 30 min.                 |
| Avisos a seguir                  | _E.Leclerc y todos los distribuidores_ (por defecto), o _solo los que citan E.Leclerc_. |
| Categorías                       | Vacío para seguirlas todas, o elija algunas (alimentación, animales…).                  |
| Avisos de los últimos (días)     | Cuántos días abarcan el contador y la lista. Por defecto: 30.                           |
| Intervalo de actualización (min) | Con qué frecuencia se lee RappelConso. Por defecto: 60 minutos.                         |

Pulse después **Probar la configuración**: la respuesta dice si la tienda está
abierta y cuántos avisos le afectan.

Por último, abra la pestaña **Descubrimiento** de la integración y cree los dos
dispositivos.

### Horario de apertura

E.Leclerc no publica una API con el horario de sus tiendas: usted lo escribe, con la
sintaxis de OpenStreetMap — a menudo ya visible en la ficha de la tienda en un mapa:

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
Ascensión y lunes de Pentecostés incluidos). Las horas se leen en hora de París.

### Qué avisos

Cada ficha indica quién vendió el producto. La integración conserva:

- las fichas que **citan E.Leclerc**;
- con _E.Leclerc y todos los distribuidores_, también las vendidas «en todos los
  distribuidores», «en supermercados» (GMS)…: E.Leclerc también las vendió, aunque
  no se le cite.

## Dispositivos

| Dispositivo               | Función                            | Notas                                       |
| ------------------------- | ---------------------------------- | ------------------------------------------- |
| Tienda                    | Abierta (1 = abierta, 0 = cerrada) | Utilizable en cualquier condición de escena |
| Tienda                    | Minutos hasta abrir o cerrar       | Actualizado cada minuto                     |
| E.Leclerc product recalls | Avisos                             | Número en el periodo configurado            |
| E.Leclerc product recalls | Último aviso                       | «Marca – producto»                          |

El dispositivo de avisos muestra una insignia **cloud** cuando RappelConso ha
respondido, e **inaccesible** si no.

## Escenas

### Disparadores

- **Se retira un producto vendido en E.Leclerc** (`product_recalled`): una nueva
  ficha afecta a su tienda. Filtros: categoría y _vendido en_ (E.Leclerc citado /
  todos los distribuidores). Variables: producto, marca, motivo, riesgos, enlace y
  número de ficha. Ejemplo: envíese el mensaje «Aviso: {{product}} — {{reason}}».
- **La tienda abre pronto** (`store_opening_soon`) y **La tienda cierra pronto**
  (`store_closing_soon`): una sola vez, los minutos configurados antes.
  Variables: nombre de la tienda, hora, minutos restantes.

Un aviso se anuncia una sola vez. Los ya publicados al instalar no se anuncian; los
publicados mientras Gladys estaba apagado sí, en el siguiente arranque.

### Acciones

- **Comprobar un código de barras** (`check_barcode`): busca un producto en todo el
  registro RappelConso. Salidas: _retirado_ (sí/no), producto, motivo, enlace.
- **¿Está abierta la tienda?** (`is_store_open`): salidas _abierta_ (sí/no), la
  hora del próximo cambio (HH:MM) y los minutos hasta entonces.

## Panel

- **Horario de la tienda**: abierta o cerrada, hasta cuándo, horario de hoy.
- **Avisos de retirada**: el contador, los últimos avisos (toque uno para ver el
  motivo, los riesgos, qué hacer y la ficha), un botón **Comprobar un código** y un
  botón **Actualizar**. El ajuste _Avisos mostrados_ fija la longitud de la lista
  (0 a 8).

## Solución de problemas

- **«No se entiende el horario»**: el mensaje cita la parte errónea. Use los días en
  inglés (`Mo`, no `Lu`) y horas `HH:MM` (`08:30`, no `8.30`).
- **RappelConso no responde**: la integración necesita internet. Vuelve a
  intentarlo en el siguiente intervalo; la última lista sigue visible.
- **No se encuentra un código de barras**: solo se encuentran los códigos impresos
  en la ficha. Compruebe también [rappel.conso.gouv.fr](https://rappel.conso.gouv.fr/).

## Datos

- Avisos: [RappelConso](https://rappel.conso.gouv.fr/), datos abiertos del
  Ministerio de Economía francés (data.economie.gouv.fr), Licence Ouverte.
- No se envía nada sobre usted: solo el código comprobado se busca en línea. La
  integración guarda la lista de avisos ya vistos en su volumen `/data`.
