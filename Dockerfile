# PRODEMUNDIAL — imagen para Oracle Cloud Always Free
# Backend Express + Worker (PM2) en un solo contenedor o VM con Node nativo

FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    tini \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Solo runtime server-side; el frontend se despliega en Vercel
ENV NODE_ENV=production
ENV API_PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npx", "pm2-runtime", "ecosystem.config.js"]
