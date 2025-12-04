---
description: How to deploy to Portainer at a specific subpath
---

# Deploy to Portainer (Subpath)

This guide explains how to deploy the app to `www.polygonconsulting.com.br/app-restaurante`.

## Configuration Changes (Already Applied)

1.  **Vite**: `base` set to `/app-restaurante/`.
2.  **Router**: `basename` set to `/app-restaurante`.
3.  **Nginx**: Configured to serve from `/app-restaurante/`.

## Steps in Portainer

1.  **Login to Portainer**.
2.  **Select Environment**: Choose your local or remote environment.
3.  **Stacks** -> **Add stack**.
4.  **Name**: `restaurant-app`.
5.  **Build Method**: "Repository".
6.  **Repository URL**: `https://github.com/diegosanchespereira1/app-restaurante` (or your repo URL).
7.  **Repository Reference**: `refs/heads/main`.
8.  **Compose File**: `docker-compose.yml`.
9.  **Environment Variables**:
    *   Add `VITE_SUPABASE_URL`: Your Supabase URL.
    *   Add `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key.
10. **Deploy the Stack**.

## Reverse Proxy (Important)

Since you are running on a VPS with a domain, you likely have a main Nginx or Traefik reverse proxy handling `www.polygonconsulting.com.br`.

You need to configure that main proxy to forward requests to this container.

**Example Main Nginx Config:**

```nginx
location /app-restaurante/ {
    proxy_pass http://localhost:8080/app-restaurante/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

*Note: The container exposes port 8080 by default in `docker-compose.yml`.*
