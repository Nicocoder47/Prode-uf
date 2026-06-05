# 🚀 RUN LOCAL - PRODEMUNDIAL 2026

Este documento describe cómo levantar el sistema completo de punta a punta (Frontend, Base de datos, Caché, Workers y Edge Functions).

## 📌 Requisitos Previos
- **Node.js**: v18+ (recomendado v20)
- **NPM**: v9+
- **Docker Desktop**: Ejecutándose (requerido para Supabase Local y Redis)
- **Supabase CLI**: Instalado globalmente (`npm install -g supabase`)

---

## ⚙️ 1. Configuración de Variables de Entorno

Duplica el archivo de ejemplo:
```bash
cp .env.example .env.local
```
*Nota: Las claves `VITE_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` locales te las dará la consola al ejecutar `supabase start` en el siguiente paso.*

---

## 🏗️ 2. Levantar Infraestructura (Supabase + Redis)

El comando `services:up` levantará el contenedor de Redis y el ecosistema local de Supabase:

```bash
npm run services:up
```
Al terminar, la terminal mostrará tus URL locales de Supabase y las keys. **Cópialas en tu `.env.local`.**

*(Para aplicar las migraciones a tu base de datos local, Supabase CLI las aplicará automáticamente desde el directorio `supabase/migrations/`)*

---

## ⚡ 3. Servir Edge Functions (Opcional pero recomendado)

Para que el Scoring Engine y los Webhooks de MercadoPago funcionen:

```bash
npm run functions:serve
```
*Esto dejará un proceso escuchando las llamadas a las funciones de Supabase.*

---

## 🤖 4. Levantar el Worker (Data Engine)

El worker (encargado de sincronizar con API-Football/FIFA y escribir en Redis) se levanta ejecutando:

```bash
npm run worker
```
*Deberías ver en consola los logs `[SYNC] Ejecutando Live Matches...` cada 30 segundos.*

---

## 🌐 5. Levantar el Frontend (React/Vite)

Finalmente, en una nueva terminal, corre el frontend:

```bash
npm run dev
```
Accede a `http://localhost:5173`.

---

## 🛑 Apagar Todo

Cuando termines de trabajar, baja los servicios correctamente para evitar consumo de RAM o puertos huérfanos:

```bash
npm run services:down
```

## 🛠 Troubleshooting
- **Error de puerto ocupado:** Asegúrate de que no tengas otra instancia de Postgres corriendo en el puerto 54322 (o 5432).
- **Redis Connection Error en Worker:** Verifica que el contenedor `prode_redis` esté encendido (`docker ps`).