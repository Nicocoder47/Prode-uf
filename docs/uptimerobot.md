# PRODEMUNDIAL 2026 — Monitoreo gratuito (UptimeRobot)

Plan **Free** de [UptimeRobot](https://uptimerobot.com/) — hasta 50 monitores, chequeo cada 5 minutos.

## Endpoints a monitorear

| Monitor | URL | Tipo | Esperado |
|---------|-----|------|----------|
| Frontend Vercel | `https://prodemundialprode.vercel.app` | HTTP(s) | HTTP 200 |
| API Health (Oracle) | `https://TU-IP-O-ORACLE:3001/api/health` | HTTP(s) | JSON `{ "status": "ok" }` |
| Supabase REST | `https://irklqwsnehlfcgehvscm.supabase.co/rest/v1/` | HTTP(s) | HTTP 200 (con header apikey) |

> Sustituir `TU-IP-O-ORACLE` por la IP pública o dominio del backend en Oracle Cloud una vez desplegado.

## Configuración paso a paso

### 1. Crear cuenta

1. Registrarse en https://uptimerobot.com/
2. Plan: **Free**

### 2. Monitor frontend

1. **Add New Monitor**
2. Monitor Type: **HTTP(s)**
3. Friendly Name: `PRODEMUNDIAL Frontend`
4. URL: `https://prodemundialprode.vercel.app`
5. Monitoring Interval: **5 minutes**
6. Alert Contacts: email personal

### 3. Monitor API (Oracle)

1. **Add New Monitor**
2. Monitor Type: **HTTP(s)**
3. Friendly Name: `PRODEMUNDIAL API Health`
4. URL: `https://<oracle-host>/api/health`
5. (Opcional) Keyword monitoring: keyword `ok` — detecta `{ "status": "ok" }`

### 4. Monitor Admin (opcional)

El panel `/admin/system` requiere autenticación admin. Para monitoreo público usar solo `/api/health`.

Si se expone un endpoint público de estado en el futuro, agregarlo aquí. **Hoy:** monitorear `/api/admin/system/health` solo si se configura un token de lectura (no implementado).

### 5. Alertas

- Email gratuito incluido
- Integración Slack/Discord disponible en plan free con webhook

## Heartbeat del worker

El worker escribe en Supabase tabla `system_snapshots` (`snapshot_type = worker_heartbeat`) cada ~60s.

UptimeRobot **no** puede leer Supabase directamente. Alternativas gratuitas:

1. Monitorear `/api/health` en Oracle (incluye check Supabase)
2. Revisar `/admin/system` manualmente o vía script local: `npm run audit:worker-health`

## Checklist post-configuración

- [ ] Frontend monitor activo (verde)
- [ ] API monitor activo tras deploy Oracle
- [ ] Alert contact verificado (email de prueba recibido)
- [ ] Documentar IP/host Oracle en `.env.cloud` → `VITE_API_BASE_URL`

## Comandos locales de auditoría

```bash
npm run audit:cloud
npm run audit:worker-health
npm run audit:production
```

Generan reportes en `reports/` para revisión periódica sin depender de UptimeRobot.
