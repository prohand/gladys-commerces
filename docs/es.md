# E.Leclerc — guía de uso

Esta integración trae a Gladys dos cosas de E.Leclerc:

- el **horario** de su tienda: si está abierta, y cuándo abre o cierra;
- sus **tarjetas de fidelidad** (Carte E.Leclerc): su código de barras en el panel,
  para escanearlo en caja desde el móvil, y su saldo.

Todo se calcula en Gladys: sin cuenta, sin contraseña, nada se envía a internet. Es
una integración comunitaria: E.Leclerc no la hace, no la revisa ni le da soporte.

## Instalación

Abra **Integraciones**, busque **E.Leclerc**, instálela y rellene la pantalla
**Configuración**.

| Campo                    | Qué poner                                                                      |
| ------------------------ | ------------------------------------------------------------------------------ |
| Nombre de la tienda      | El nombre del dispositivo tienda en Gladys, p. ej. `E.Leclerc Carcassonne`.    |
| Horario de apertura      | El horario de la tienda (ver abajo). Por defecto: `Mo-Sa 08:30-20:00; PH off`. |
| Aviso antes de ... (min) | Cuándo se activan «abre pronto» / «cierra pronto». Por defecto: 30 min.        |
| Números de tarjeta       | Sus tarjetas de fidelidad (ver abajo). Vacío si no tiene ninguna.              |

Pulse después **Probar la configuración**: la respuesta dice si la tienda está
abierta y qué tarjetas se han entendido.

Por último, abra la pestaña **Descubrimiento** de la integración y cree los
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

### Tarjetas de fidelidad

Una tarjeta por persona: un nombre, `=`, y el número impreso bajo el código de barras
de la tarjeta. Separe las tarjetas con `;`:

```
Marie=2900123456785; Paul=2900987654327
```

Los espacios y guiones del número se ignoran; el nombre es opcional. 10 tarjetas como
máximo.

**Sobre el saldo.** E.Leclerc no ofrece una API pública para sus tarjetas: el saldo
«Ticket E.Leclerc» no se puede leer automáticamente sin su contraseña, mediante una
interfaz no oficial que puede dejar de funcionar en cualquier momento. La integración
no lo hace. Usted introduce el saldo — desde el widget o una escena — y Gladys lo
guarda, con su historial.

## Dispositivos

| Dispositivo               | Función                            | Notas                                            |
| ------------------------- | ---------------------------------- | ------------------------------------------------ |
| Tienda                    | Abierta (1 = abierta, 0 = cerrada) | Utilizable en cualquier condición de escena      |
| Tienda                    | Minutos hasta abrir o cerrar       | Actualizado cada minuto                          |
| E.Leclerc card _<nombre>_ | Saldo (€)                          | Introducido por usted; utilizable en condiciones |

## Escenas

### Disparadores

- **La tienda abre pronto** (`store_opening_soon`) y **La tienda cierra pronto**
  (`store_closing_soon`): una sola vez, los minutos configurados antes. Variables:
  nombre de la tienda, hora, minutos restantes. Ejemplo: «La tienda cierra a las
  {{time}}, quedan {{minutes_left}} minutos.»

«La tienda está abierta» y «el saldo supera 10 €» son estados: use las condiciones
de dispositivo de Gladys.

### Acciones

- **¿Está abierta la tienda?** (`is_store_open`): salidas _abierta_ (sí/no), la hora
  del próximo cambio (HH:MM) y los minutos hasta entonces.
- **Actualizar el saldo de una tarjeta** (`set_loyalty_balance`): elija una tarjeta y
  luego _fijar el saldo en_ un importe, o _sumar al saldo_ (un importe negativo para
  gastar). Salida: el nuevo saldo. Nunca baja de 0.

## Panel

- **Horario de la tienda**: abierta o cerrada, hasta cuándo, horario de hoy.
- **Tarjeta de fidelidad**: el código de barras de una tarjeta (ajuste _Tarjeta_;
  vacío = la primera), su saldo y su número, y un botón **Actualizar el saldo**.
  Muéstrelo en caja: suba el brillo del móvil para el escáner.

El código es un EAN-13 cuando el número de tarjeta lo es (13 cifras, dígito de
control válido), y un Code 128 si no. Los escáneres de caja leen ambos.

## Solución de problemas

- **«No se entiende el horario»**: el mensaje cita la parte errónea. Use los días en
  inglés (`Mo`, no `Lu`) y horas `HH:MM` (`08:30`, no `8.30`).
- **Una tarjeta «no se entiende»**: el número debe tener de 6 a 20 cifras.
  **Probar la configuración** lista lo que no se ha entendido.
- **La caja no lee el código**: compruebe el número, suba el brillo y amplíe el
  widget. Si su tarjeta lleva otro tipo de código de barras, indíquelo en una issue.

## Datos

Nada sale de su Gladys. Los saldos se guardan en el volumen `/data` de la integración
(`cards.json`) y como estados de Gladys.
