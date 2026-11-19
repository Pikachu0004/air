# AirLoop Deployment Guide

AirLoop is architected as a modern, zero-dependency full-stack application. It can be deployed in under 2 minutes to **Vercel**, **Render**, **Railway**, **Netlify**, or self-hosted via **Node.js / PM2 / Docker**.

---

## 🔑 Prerequisite: Get Your Free Google Gemini API Key

1. Visit [Google AI Studio (ai.google.dev)](https://aistudio.google.com/app/apikey).
2. Sign in with any Google account.
3. Click **"Create API Key"** and copy your key (starts with `AIzaSy...`).
   - *Note: Google AI Studio provides a 100% free tier (15 requests/min, no credit card required).*

---

## 🚀 Option 1: Deploy to Vercel (Recommended · Fastest)

Vercel natively serves all static HTML pages and automatically turns `/api/chat.js` and `/api/forecast.js` into serverless edge functions.

### Method A: Deploy via Vercel CLI (Instant)
1. Open your terminal in the project directory:
   ```bash
   cd "/Users/macbook/Code Kishan Project/urbanair"
   ```
2. Run the Vercel deployment command:
   ```bash
   npx vercel
   ```
3. Follow the prompts (press Enter for defaults).
4. Add your Gemini API key:
   ```bash
   npx vercel env add GEMINI_API_KEY
   # Paste your Gemini API key when prompted, select Production, Preview, Development
   ```
5. Deploy to production:
   ```bash
   npx vercel --prod
   ```

### Method B: Deploy via GitHub + Vercel Dashboard
1. Initialize Git and push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: AirLoop v3.0 Urban Air Defense Platform"
   git branch -M main
   # Create a repo on github.com and link:
   git remote add origin https://github.com/<your-username>/urbanair.git
   git push -u origin main
   ```
2. Go to [vercel.com/new](https://vercel.com/new).
3. Import your `urbanair` repository.
4. In **Environment Variables**, add:
   - `GEMINI_API_KEY`: `AIzaSy...`
   - `GEMINI_MODEL`: `gemini-1.5-flash`
5. Click **Deploy**. Your app will be live on a `*.vercel.app` URL with SSL!

---

## 🚅 Option 2: Deploy to Render / Railway (Full-Stack Node.js)

Since AirLoop includes `server.js` and `package.json`, it can run as a long-running Node.js web service.

### On Render (render.com):
1. Create a new **Web Service** and connect your GitHub repository.
2. Configure settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install` (or leave empty)
   - **Start Command**: `npm start` (runs `node server.js`)
3. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: `AIzaSy...`
   - `PORT`: `10000` (Render defaults to 10000)
4. Click **Create Web Service**.

### On Railway (railway.app):
1. Click **New Project** → **Deploy from GitHub repo**.
2. Select `urbanair`. Railway automatically detects `server.js`.
3. In **Variables**, add:
   - `GEMINI_API_KEY`: `AIzaSy...`
4. Railway will deploy and assign a public domain.

---

## 🌐 Option 3: Deploy to Netlify

1. Connect your repository on [app.netlify.com](https://app.netlify.com).
2. Settings:
   - **Publish directory**: `.` (Root)
   - **Functions directory**: `api`
3. In **Site Configuration** → **Environment variables**, add:
   - `GEMINI_API_KEY`: `AIzaSy...`
4. Click **Deploy Site**.

---

## 🖥️ Option 4: Local Production or Self-Hosted VPS (PM2)

To run the server continuously on a local machine, Raspberry Pi, or Ubuntu VPS:

1. Open `.env` and paste your key:
   ```env
   GEMINI_API_KEY=AIzaSy...
   GEMINI_MODEL=gemini-1.5-flash
   PORT=3000
   ```
2. Install PM2 (Process Manager):
   ```bash
   npm install -g pm2
   ```
3. Start AirLoop with auto-restart:
   ```bash
   pm2 start server.js --name airloop
   pm2 save
   ```
4. Access locally at `http://localhost:3000`.

---

## 🛡️ Security Best Practices
- `.gitignore` is pre-configured to exclude `.env` and `.env*.local`.
- Never commit your actual Gemini API key to GitHub.
- If no API key is provided, AirLoop automatically falls back to its built-in clinical heuristic engine so the site never crashes.
