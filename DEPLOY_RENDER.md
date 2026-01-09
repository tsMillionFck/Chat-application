# How to Deploy to Render

Render is a great choice for this chat application because it supports **persistent connections** (WebSockets), which are required for Socket.IO to work reliably.

## Prerequisites

1.  **Push to GitHub**: Ensure your latest code is pushed to your GitHub repository.
    ```bash
    git add .
    git commit -m "Prepare for Render"
    git push origin main
    ```

## Step-by-Step Guide

1.  **Create a Render Account**: Go to [dashboard.render.com](https://dashboard.render.com/) and log in (recommended: log in with GitHub).
2.  **New Web Service**:
    - Click the **"New +"** button.
    - Select **"Web Service"**.
3.  **Connect Repository**:
    - Find your `Chat-application` repository in the list.
    - Click **"Connect"**.
4.  **Configure Settings**:
    - **Name**: `my-chat-app` (or whatever you like).
    - **Region**: Choose the one closest to you (e.g., Singapore, Frankfurt).
    - **Branch**: `main`.
    - **Root Directory**: Leave empty (defaults to root).
    - **Runtime**: **Node**.
    - **Build Command**: `npm install`.
    - **Start Command**: `node server.js`.
    - **Plan**: **Free** (this is sufficient for testing).
5.  **Deploy**:
    - Click **"Create Web Service"**.
    - Wait for the deployment logs to finish. You should see "Core-Mind Active on port..."
6.  **Done!**
    - Your app will be live at a URL like `https://my-chat-app.onrender.com`.
    - Share this link with friends to chat!

> [!NOTE]
> Unlike Vercel, Render's free tier spins down after inactivity. The first request after a while might take 30-50 seconds to load. This is normal.
