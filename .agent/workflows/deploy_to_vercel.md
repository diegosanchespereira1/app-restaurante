---
description: How to deploy the React + Vite app to Vercel
---

# Deploy to Vercel

This guide explains how to deploy your restaurant application to Vercel.

## Prerequisites

1.  A [Vercel account](https://vercel.com/signup).
2.  Your project pushed to GitHub (already done).

## Steps

1.  **Login to Vercel**: Go to [vercel.com](https://vercel.com) and log in.
2.  **Add New Project**:
    *   Click "Add New..." -> "Project".
    *   Import your GitHub repository: `app-restaurante`.
3.  **Configure Project**:
    *   **Framework Preset**: Vite (should be detected automatically).
    *   **Root Directory**: `./` (default).
    *   **Environment Variables**: You MUST add your Supabase credentials here.
        *   Expand "Environment Variables".
        *   Add `VITE_SUPABASE_URL` with the value from your local `.env`.
        *   Add `VITE_SUPABASE_ANON_KEY` with the value from your local `.env`.
4.  **Deploy**:
    *   Click "Deploy".
    *   Wait for the build to finish.

## Post-Deployment

*   Your app will be live at a `*.vercel.app` URL.
*   **Supabase Auth**: You need to add your new Vercel URL to Supabase.
    *   Go to [Supabase Dashboard](https://supabase.com/dashboard).
    *   Select your project -> Authentication -> URL Configuration.
    *   Add your Vercel URL (e.g., `https://app-restaurante.vercel.app`) to "Site URL" and "Redirect URLs".
