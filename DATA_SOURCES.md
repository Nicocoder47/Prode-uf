# Datos reales de jugadores para ProdeMundial 2026

## Objetivo

Agregar una capa diaria de inteligencia de jugadores para enriquecer predicciones:

- lesiones y suspensiones
- alineaciones probables y oficiales
- ratings por partido
- valor de mercado
- forma reciente
- alertas de cambio antes del cierre

## Proveedores recomendados

### 1. BALLDONTLIE FIFA World Cup API

Uso principal: datos especificos del Mundial.

Campos:

- equipos y planteles
- partidos
- alineaciones
- eventos en vivo
- estadisticas por jugador
- rating promedio
- odds

Frecuencia:

- cada 15 minutos durante el dia
- cada 30 segundos durante partidos en vivo
- inmediatamente cuando se publiquen alineaciones oficiales

### 2. Sportmonks Football API

Uso principal: disponibilidad del jugador y contexto amplio.

Campos:

- lesiones
- suspensiones
- estado sidelined
- perfiles de jugadores
- lineups probables
- datos historicos de forma

Frecuencia:

- cada 1 hora
- cada 10 minutos desde 2 horas antes del kickoff

### 3. Proveedor de valor de mercado

Uso principal: valoracion economica y metadata de club.

Campos:

- valor de mercado
- club actual
- edad
- posicion
- historial basico

Frecuencia:

- una vez por dia a las 06:00 ART
- manual refresh si hay cambio fuerte de plantel

## Flujo diario

1. 06:00 ART: sincronizar planteles, valores de mercado y lesiones.
2. Cada hora: actualizar disponibilidad, suspensiones y reportes de forma.
3. Dos horas antes del partido: aumentar frecuencia de lineups probables.
4. Al publicarse alineaciones oficiales: guardar titulares y bloquear mercados sensibles.
5. Durante el partido: sincronizar eventos, tarjetas, cambios, goles y ratings.
6. Post partido: guardar estadisticas finales y recalcular puntos.

## Modelo de datos agregado

Tablas nuevas en `SUPABASE_SCHEMA.sql`:

- `player_market_values`
- `player_availability`
- `player_ratings`
- `lineups`
- `data_sync_logs`

## Reglas de producto

- Todo dato usado para puntuar o bloquear predicciones debe guardar proveedor y fecha.
- El admin puede hacer override manual cuando haya una noticia confiable de ultimo momento.
- Los mercados de primer goleador, MVP y tarjetas deben cerrarse cuando la alineacion oficial cambie el riesgo de un jugador clave.
- La app debe mostrar al usuario si un dato es oficial, probable o corregido manualmente.
