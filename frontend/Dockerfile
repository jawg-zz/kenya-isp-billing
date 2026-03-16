# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS runner

RUN apk add --no-cache nginx

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Nginx config - proxies /api/ to API, serves frontend on 3000
COPY <<'EOF' /etc/nginx/nginx.conf
worker_processes auto;
events { worker_connections 1024; }
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    upstream nextjs { server 127.0.0.1:3001; }
    upstream api { server api:3000; }
    server {
        listen 3000;
        client_max_body_size 20M;
        location /api/ {
            proxy_pass http://api;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        location / {
            proxy_pass http://nextjs;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}
EOF

# Startup script: run Next.js on 3001, nginx on 3000
COPY <<'EOF' /app/start.sh
#!/bin/sh
PORT=3001 HOSTNAME="0.0.0.0" node /app/server.js &
nginx -g 'daemon off;'
EOF
RUN chmod +x /app/start.sh

EXPOSE 3000

CMD ["/app/start.sh"]
