# 🗺️ MAPA DE NAVEGACIÓN - PRODEMUNDIAL 2026

## Flujo Principal de Aplicación

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRODEMUNDIAL 2026                                   │
│                    Private FIFA World Cup 2026                              │
└─────────────────────────────────────────────────────────────────────────────┘

                                    │
                                    ↓
                        ┌───────────────────────┐
                        │   /invite             │
                        │  Login & Invite Code  │
                        │   (PUBLIC)            │
                        └───────────────────────┘
                                    │
                        ✓ Válido → │
                                    ↓
            ┌───────────────────────────────────────────────────────┐
            │              PROTECTED SHELL (AppShell)              │
            │                                                       │
            │  ┌─────────────────────────────────────────────────┐ │
            │  │  HEADER                                         │ │
            │  │  Badge "Private & Invite-Only" | Welcome | 🔔   │ │
            │  └─────────────────────────────────────────────────┘ │
            │  ┌──────────┐  ┌──────────────────────────────────┐ │
            │  │ SIDEBAR  │  │    MAIN CONTENT AREA             │ │
            │  │          │  │    (Route-based)                 │ │
            │  │ • 🏠 Home│  │                                  │ │
            │  │ • ⚽ Match│  │  Dynamic Content per Route       │ │
            │  │ • 🎯 Pred│  │                                  │ │
            │  │ • 🏆 Lead│  │                                  │ │
            │  │ • 💳 Pay │  │                                  │ │
            │  │ • 👤 Adm │  │                                  │ │
            │  │          │  │                                  │ │
            │  │ 💰 $1.240│  │                                  │ │
            │  │ Tokens   │  │                                  │ │
            │  └──────────┘  └──────────────────────────────────┘ │
            │                                                       │
            └───────────────────────────────────────────────────────┘
```

---

## RUTAS Y PÁGINAS COMPLETAS

### 🏠 DASHBOARD (`/`)
```
╔════════════════════════════════════════════════════════╗
║  🔴 LIVE  |  Brasil vs Argentina  |  ⏱️ 2h 15m      ║
║  Cuartos de final • MetLife Stadium, NY               ║
╚════════════════════════════════════════════════════════╝

┌──────────────────────┐  ┌──────────────────────┐
│  Pool: $2.4M         │  │  Tokens: $1.240      │
│  Predicciones: 8.4K  │  │  Live: 3 matches     │
└──────────────────────┘  └──────────────────────┘

LEFT COLUMN                RIGHT COLUMN
┌─────────────────────┐  ┌──────────────────┐
│ 🇧🇷 vs 🇦🇷 1-0   │  │ ⭐ 2.880 pts    │
│ Actualización 82'   │  │ ✓ 148 predicc    │
└─────────────────────┘  │ 🔥 Racha 12d     │
│ 🇸🇵 vs 🇳🇱 0-1   │  │ 💰 $85K ganados  │
│ Actualización 45'   │  │ 🥇 #1 Global    │
└─────────────────────┘  │ 📊 Top 5:        │
│ 🇩🇪 vs 🇫🇷 1-1   │  │ 1. Nico - 2.880  │
│ En vivo - 72'       │  │ 2. Luna - 2.540  │
└─────────────────────┘  │ ...              │
                         └──────────────────┘
```

### ⚽ MATCHES (`/matches`)
```
╔════════════════════════════════════════════════════════╗
║  PRÓXIMOS PARTIDOS                                    ║
║  Filtros: [Todos ▼] [Hoy ▼] [Grupo ▼]              ║
╚════════════════════════════════════════════════════════╝

🇧🇷 BRASIL vs ARGENTINA 🇦🇷
├─ Estado: En vivo (45')
├─ Estadio: MetLife Stadium, NY
├─ Score: 1 - 0
└─ [🎯 Hacer predicción]

🇸🇵 ESPAÑA vs HOLANDA 🇳🇱
├─ Estado: Próximamente (2h)
├─ Estadio: Lusail Stadium
├─ Score: -- - --
└─ [🎯 Hacer predicción]

🇩🇪 ALEMANIA vs FRANCIA 🇫🇷
├─ Estado: Próximamente (8h)
├─ Estadio: Al Bayt Stadium
├─ Score: -- - --
└─ [🎯 Hacer predicción]
```

### 🎯 MATCH DETAIL (`/matches/:id`)
```
╔════════════════════════════════════════════════════════╗
║  🔴 LIVE  |  Brasil vs Argentina  |  ⏱️ 2h 15m      ║
║  Cuartos de final • MetLife Stadium, NY               ║
╚════════════════════════════════════════════════════════╝

STATS EN VIVO
Posesión: 52% - 48%
Tiros: 12 - 9
Faltas: 8 - 11
Tarjetas: 1Y - 2Y
xG: 2.1 - 1.8

┌─────────────────────────────────┐  ┌────────────────────────────────┐
│ PRIMER GOLEADOR                 │  │ JUGADOR DEL PARTIDO (MVP)      │
│ Selecciona quién anotará primero│  │ ¿Quién mejor performance?      │
│ ┌──────────────────────────────┐│  │ ┌─────────────────────────────┐│
│ │ Neymar 🟦 ┆ LW ┆ 9.2 ⭐      ││  │ │ Mbappé 🟦 ┆ ST ┆ 9.5 ⭐  ││
│ │ Vinícius Jr 🟦 ┆ LW         ││  │ │ Benzema 🟦 ┆ ST ┆ 8.8 ⭐  ││
│ │ Rodrygo 🟦 ┆ RW ┆ 8.1 ⭐    ││  │ │ Griezmann 🟦 ┆ CAM        ││
│ └──────────────────────────────┘│  │ └─────────────────────────────┘│
└─────────────────────────────────┘  └────────────────────────────────┘

FORMULARIO DE PREDICCIÓN
┌─────────────┬─────────────┬──────────────┐
│ Brasil 1-0  │  Empate 0-0 │ Argentina 1-0│
│ SELECCIONADO│             │              │
└─────────────┴─────────────┴──────────────┘

Primer Goleador: Neymar
MVP: Mbappé
Costo Total: 3 tokens

[➜ CONFIRMAR PREDICCIÓN]
```

### 📊 PREDICTIONS (`/predictions`)
```
╔════════════════════════════════════════════════════════╗
║  MIS PREDICCIONES                                     ║
║  Filtros: [Todas ▼] [Activas ▼]                    ║
╚════════════════════════════════════════════════════════╝

✓ GANADA - Brasil 1-0 Argentina (hace 2h)
├─ Primer Goleador: Neymar ✓
├─ MVP: Mbappé ✓
└─ Ganancias: +280 pts | +$85

⏳ ACTIVA - España vs Holanda (próximo)
├─ Primer Goleador: Gavi
├─ MVP: de Jong
└─ Costo: 3 tokens

✗ PERDIDA - Alemania 1-1 Francia
├─ Predicción: 2-0
└─ Pérdidas: -120 pts
```

### 🏆 LEADERBOARD (`/leaderboard`)
```
╔════════════════════════════════════════════════════════╗
║  RANKINGS GLOBALES                                    ║
║  Tabs: [Global] [Esta Semana] [Este Mes]           ║
╚════════════════════════════════════════════════════════╝

🥇 Nico          2.880 pts  ↑ 45   🎁 $500 pool
🥈 Luna          2.540 pts  ↓ 12   🎁 $300 pool
🥉 Matias        2.420 pts  ↑ 28   🎁 $200 pool
4️⃣  Isa          2.240 pts  ↔ 0
5️⃣  Sofi         2.180 pts  ↓ 35

(11,237 usuarios más...)
```

### 💳 PAYMENTS (`/payments`)
```
╔════════════════════════════════════════════════════════╗
║  MIS TRANSACCIONES                                    ║
║  Saldo: $1.240 ARS | Pendiente: $500                ║
╚════════════════════════════════════════════════════════╝

HISTORIAL
✓ 2025-01-15 | +$500 | Depósito Mercado Pago
✓ 2025-01-14 | +$85  | Ganancias predicción
✗ 2025-01-13 | -$180 | Predicciones perdidas
✓ 2025-01-12 | +$420 | Ganancias predicción

MÉTODOS DE PAGO
┌─────────────────┐  ┌──────────────────┐
│ Mercado Pago    │  │ Transferencia    │
│ [Agregar]       │  │ [Agregar]        │
└─────────────────┘  └──────────────────┘
```

### 👤 PROFILE (`/profile`)
```
╔════════════════════════════════════════════════════════╗
║  [🎮] Nico                                            ║
║  Miembro desde 15 mayo • Nivel 8 • Ranked #1         ║
║  🔥 Racha 12d | 🏆 35 victorias | 📈 66.7% precisión ║
║  [Editar perfil] [Compartir]                         ║
╚════════════════════════════════════════════════════════╝

ESTADÍSTICAS TEMPORADA        NIVEL
┌──────────────────────────┐  ┌─────────────────┐
│ ⭐ Pts: 2.880            │  │ ⭐ Nivel 8      │
│ 🎯 Predicciones: 148     │  │ 320/500 XP      │
│ ✓ Aciertos: 99 (+12%)    │  │ [████░░░░░]    │
│ 💰 Ganancias: $85K (+15%)│  │                 │
└──────────────────────────┘  └─────────────────┘

LOGROS DESBLOQUEADOS
🎯 First Prediction ✓
🔥 Streak 5 ✓
💯 Perfect Combo ✓
🏆 Top 3 (bloqueado)
💰 Token Master (bloqueado)
⭐ MVP Scout (bloqueado)

RENDIMIENTO SEMANAL
Lunes:   [████░░░░░░░░] 420 pts
Martes:  [██████░░░░░░] 560 pts
Miércoles: [░░░░░░░░░░░░] 0 pts

ENFRENTAMIENTOS RECIENTES
vs Luna    | ✓ Ganaste 280 pts | hace 2h
vs Mati    | ✗ Perdiste 120 pts | hace 1d
vs Isa     | ✓ Ganaste 420 pts | hace 3d
```

### 🛠️ ADMIN (`/admin`)
```
╔════════════════════════════════════════════════════════╗
║  PANEL ADMINISTRATIVO - PRODEMUNDIAL OPERATIONS      ║
╚════════════════════════════════════════════════════════╝

KPIs EN VIVO
┌──────────┬──────────┬──────────┬──────────┐
│ Usuarios │ Pozo     │ Predic.  │ Partidos │
│ 1.240    │ $2.4M    │ 8.420    │ 3 🔴    │
└──────────┴──────────┴──────────┴──────────┘

HEALTH CHECK
✓ Supabase      42ms  (healthy)
✓ API-Football  186ms (healthy)
✓ Mercado Pago  95ms  (healthy)
⚠ Scraper       Error (warning)

PAGOS EN COLA
Juan Pérez    | $50K | Transferencia  | Hace 1h
  [✓ Aprobar] [✗ Rechazar]
María López   | $100K| Mercado Pago  | Hace 3h
  [✓ Aprobar] [✗ Rechazar]

SCORING LOGS
✓ [02:45:32] Scoring completado: BRA 2-1 ARG (48 usuarios)
✓ [01:20:15] Leaderboard actualizado
⚠ [00:58:44] Reintentando webhook Mercado Pago (2/3)
✓ [00:12:09] Notificaciones WhatsApp (1.240 msgs)

ACCIONES CRÍTICAS
[⚙️ Forzar scoring]
[🕐 Cambiar MVP]
[📊 Recalcular ranking]
[⚡ Ejecutar cron manual]

ALERTAS
⚠ API-Football: 850/900 límites
✓ BD: Bajo 80% capacidad
```

---

## 🔄 FLUJOS DE USUARIO COMUNES

### 📍 Flujo: Hacer una predicción
```
Dashboard
   ↓
[Ver partido]
   ↓
MatchDetail
   ↓
[Seleccionar Primer Goleador]
   ↓
[Seleccionar MVP]
   ↓
[Elegir resultado]
   ↓
[Confirmar - 3 tokens]
   ↓
Predicción guardada ✓
```

### 📍 Flujo: Revisar rendimiento
```
Profile
   ↓
[Ver Estadísticas]
   ↓
[Ver Logros desbloqueados]
   ↓
[Ver Enfrentamientos recientes]
   ↓
[Compartir perfil]
```

### 📍 Flujo: Administrador aprueba pago
```
Admin Panel
   ↓
[Ver Pagos en cola]
   ↓
[Revisar: Juan Pérez $50K]
   ↓
[✓ Aprobar]
   ↓
Usuario acreditado con $50K tokens
Notificación enviada
```

---

## 🎨 CARACTERISTICAS DE UX

### Dark Mode Glassmorphism
- Fondo con gradiente radial (cyan + violet)
- Tarjetas semi-transparentes (white/10)
- Blur backdrop (30px)
- Glows de colores (cyan, violet, gold, emerald, red)

### Animaciones Omnipresentes
- Entry staggered (0.1s between items)
- Hover scale + brightness
- Live pulse (1.5s opacity loop)
- Countdown pulsing
- Achievement badges glow on hover
- Motion layout transitions

### Responsividad
- Mobile first approach
- lg: grid-cols-2/3/4 breakpoints
- sm: grid-cols-2 adjustments
- Touch-optimized button sizes (py-3 minimum)
- Readable font sizes (text-sm minimum for UI)

---

Generated: 2025 | PRODEMUNDIAL 2026 Navigation Map
