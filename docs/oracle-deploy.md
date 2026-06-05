# PRODEMUNDIAL 2026 — Deploy en Oracle Cloud Always Free

Backend Express + Worker permanente (PM2). Frontend en Vercel. DB en Supabase cloud.

## Requisitos

- Cuenta Oracle Cloud (Always Free ARM VM recomendada: 4 OCPU / 24 GB RAM)
- Proyecto Supabase cloud configurado
- Upstash Redis free (opcional)
- Dominio o IP pública

## 1. Crear VM

1. Oracle Cloud Console → Compute → Instances → Create
2. Shape: **Ampere A1** (Always Free eligible)
3. Image: **Ubuntu 22.04**
4. Abrir puertos en Security List / NSG:
   - **22** (SSH)
   - **3001** (Express API) o usar nginx reverse proxy en 443

## 2. Instalar dependencias en la VM

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential

# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 global
sudo npm install -g pm2 tsx
```

## 3. Clonar y configurar

```bash
git clone https://github.com/TU_USUARIO/prode.git
cd prode
npm ci
```

Crear `.env` en la raíz (nunca commitear):

```bash
# Supabase cloud
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# APIs deportivas
FOOTBALL_DATA_API_KEY=...
API_FOOTBALL_KEY=...

# Redis Upstash (opcional — rediss://default:xxx@xxx.upstash.io:6379)
REDIS_URL=rediss://default:PASSWORD@HOST.upstash.io:6379

NODE_ENV=production
API_PORT=3001
WORKER_HOST=oracle-vm-1
CORS_ORIGIN=https://tu-app.vercel.app
```

Aplicar migraciones Supabase desde tu PC:

```bash
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

## 4. Arrancar con PM2

```bash
cd /home/ubuntu/prode
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# ejecutar el comando que PM2 imprime
```

Verificar:

```bash
curl http://localhost:3001/api/health
npm run audit:worker-health
```

## 5. Firewall y acceso público

```bash
# Opción A: exponer puerto 3001 (solo para pruebas)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3001 -j ACCEPT
```

**Recomendado:** nginx + Let's Encrypt en 443:

```nginx
server {
  listen 443 ssl;
  server_name api.tudominio.com;
  ssl_certificate /etc/letsencrypt/live/api.tudominio.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.tudominio.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

En Vercel, configurar:

```
VITE_API_BASE_URL=https://api.tudominio.com
```

## 6. Docker (alternativa)

```bash
docker build -t prodemundial .
docker run -d --name prodem --env-file .env -p 3001:3001 --restart unless-stopped prodemundial
```

## 7. Monitoreo UptimeRobot

Crear monitors HTTP(s):

| URL | Intervalo |
|-----|-----------|
| `https://api.tudominio.com/api/health` | 5 min |
| `https://tu-app.vercel.app` | 5 min |

## 8. Comandos útiles

```bash
pm2 logs prodem-worker
pm2 logs prodem-api
pm2 restart all
npm run sync:knockout
npm run audit:system-health
```

## 9. Checklist post-deploy

- [ ] `GET /api/health` → `{ ok: true }`
- [ ] `/admin/system` muestra worker **online**
- [ ] Predicciones y leaderboard cargan desde Supabase
- [ ] `reports/worker-health.json` con status online tras 30s
