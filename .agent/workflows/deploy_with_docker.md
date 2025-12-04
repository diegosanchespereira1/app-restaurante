---
description: How to build and run the application using Docker
---

# Deploy with Docker

This guide explains how to containerize and run the application using Docker.

## Prerequisites

1.  [Docker](https://www.docker.com/get-started) installed on your machine.
2.  A `.env` file in the project root with your Supabase credentials (see `.env.example`).

## Option 1: Using Docker Compose (Recommended)

This is the easiest way to run the app locally.

1.  **Build and Run**:
    ```bash
    docker-compose up --build -d
    ```
    *   `--build`: Rebuilds the image.
    *   `-d`: Runs in detached mode (background).

2.  **Access the App**:
    Open [http://localhost:8080](http://localhost:8080) in your browser.

3.  **Stop the App**:
    ```bash
    docker-compose down
    ```

## Option 2: Building Manually

If you want to build the image manually (e.g., for a CI/CD pipeline).

1.  **Build the Image**:
    You must pass the build arguments!
    ```bash
    docker build \
      --build-arg VITE_SUPABASE_URL=your_supabase_url \
      --build-arg VITE_SUPABASE_ANON_KEY=your_anon_key \
      -t restaurant-app .
    ```

2.  **Run the Container**:
    ```bash
    docker run -p 8080:80 -d restaurant-app
    ```

## Production Deployment

To deploy to a server (e.g., AWS EC2, DigitalOcean Droplet):

1.  **Copy Files**: Copy `Dockerfile`, `nginx.conf`, `docker-compose.yml`, and `.env` to your server.
2.  **Run**: Execute `docker-compose up --build -d`.
3.  **Reverse Proxy**: It is recommended to set up a reverse proxy (like Nginx or Traefik) with SSL (HTTPS) in front of the container for production security.
