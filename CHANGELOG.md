# Cambios

## 2.0.1

- El nombre del pasajero se muestra como «NOMBRE APELLIDO» en lugar de «APELLIDO /NOMBRE».
- El localizador ya no se confunde con la clase de reserva, y la clase se lee también del reverso.
- Los campos que la aerolínea envía vacíos (p. ej. puerta sin asignar) dejan de mostrarse en blanco.

## 2.0.0

- Inicio más limpio: se eliminan los apartados «Estadísticas» y «Vuelos por mes».
- El botón «Añadir» de la barra inferior tiene el mismo estilo y tamaño que el resto.
- Corregido el nombre del pasajero (resumen del vuelo y modo «Mostrar en la puerta de embarque»):
  ya no se confunde con textos informativos de la aerolínea. Si la tarjeta no trae un campo
  de pasajero claro, el nombre se lee del propio código de embarque (formato IATA).
  La corrección se aplica también a las tarjetas ya guardadas, sin volver a importarlas.

## 1.0.0

- Primera versión: importar, ver y gestionar tarjetas `.pkpass`, creación manual,
  modo puerta de embarque, copia de seguridad y funcionamiento sin conexión.
