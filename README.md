# 🍽️ AI-Driven Smart Dining Assistant

An elegant, premium, mobile-first full-stack smart dining platform powered by an orchestrated **8-Agent AI Architecture using LangChain (gpt-4o-mini)**, **Next.js 14 App Router**, **Express**, **Socket.io**, **Redis caching**, and **Prisma PostgreSQL**.

---

## 🏗️ Architecture & Orchestration Flow

Zara operates on a highly responsive **Router-Orchestrator Architecture** designed for sub-second latencies and strict safety bounds.

```
       [ Guest Input ] (Hinglish/Telugu/English)
              │
              ▼
   ┌──────────────────────────────────────────────┐
   │          1. Multilingual NLU Agent           │  ◄── Normalizes Hinglish/Telugu input to English
   └──────────────────────────────────────────────┘
              │
              ▼
   ┌──────────────────────────────────────────────┐
   │      2. Intent Router (gpt-4o-mini)          │  ◄── Classifies intent: GREET, RECOMMEND,
   └──────────────────────────────────────────────┘      ADD_ITEM, UPSELL, GROUP, CHECKOUT
        │        │        │        │        │
        │        │        │        │        └───────► CHECKOUT: Verify Name, Phone, and OTP (123456)
        │        │        │        │
        │        │        │        └────────────────► GROUP: Roster coordination / guest count
        │        │        │
        │        │        └─────────────────────────► ADD_ITEM: Semantic Vector Store lookup &
        │        │                                                Optimistic Shared Cart addition
        │        │
        │        └──────────────────────────────────► RECOMMEND: OpenAI embeddings-3-small
        │                                                         In-Memory Cosine Similarity search
        │
        └───────────────────────────────────────────► GREET: Welcome guest at Table #
              │
              ▼
   ┌──────────────────────────────────────────────┐
   │       3. Order Validation Agent              │  ◄── Checks allergen safety of cart items
   └──────────────────────────────────────────────┘
              │
              ▼
   ┌──────────────────────────────────────────────┐
   │          4. Response Localizer               │  ◄── Translates unified response back to Hinglish
   └──────────────────────────────────────────────┘      or Telugu-English if detected
              │
              ▼
    [ Zara Chat Companion ] (Sliding Drawer / Socket Sync / Optimistic UI)
```

---

## 🌟 Key Features

1. **Zara Chat Butler**: Sliding, gorgeous glassmorphism right-drawer companion with fast, word-by-word streaming effects, suggested chips, and same-language responses.
2. **AI Semantic Search**: Sub-30ms vector search using `text-embedding-3-small` OpenAI embeddings and in-memory cosine similarity math.
3. **Direct Chat Cart Actions**: Directly request "add 2 garlic naans", which automates DB cart addition, broadcasts to table users via Socket.io, and updates UI optimistically.
4. **Intelligent Upselling**: Conversational beverage/dessert triggers matching group ordering, total > ₹500, and evening specials.
5. **Secure Verified Checkout**: High-fidelity name/phone verification gate with demo OTP `123456`, kitchen notification dispatch, and estimated wait counters.
6. **Robust Rate-limiting & Shields**: Prompt-injection regex defense, sanitization, and adaptive rate limits.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS, Zustand, React Query, Framer Motion
- **Backend**: Node.js, Express, Socket.io (with Redis adapter), TypeScript, Prisma ORM, LangChain
- **Databases**: PostgreSQL, Redis

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` at the root and fill in the values:

```env
# Database Configuration
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smart_dining?schema=public"

# Redis Caching Configuration
REDIS_URL="redis://localhost:6379"

# API Server ports
PORT=5000
NODE_ENV=development

# Frontend Exposed
NEXT_PUBLIC_API_URL="http://localhost:5000"
NEXT_PUBLIC_WS_URL="http://localhost:5000"

# AI Integration
OPENAI_API_KEY="your-openai-api-key"
```

---

## 🚀 Quick Setup & Run

### 1. Boot Infrastructure (Docker)
Ensure Docker is running and execute:
```bash
docker compose up -d
```
This spins up PostgreSQL and Redis instantly.

### 2. Install Packages & Generate Prisma Clients
```bash
npm install --ignore-scripts
cd apps/server
npx prisma db push
npx prisma db seed
```

### 3. Run Development Servers
At the root workspace, run:
```bash
npm run dev
```
- Next.js Web App: `http://localhost:3000`
- API Backend & Websockets: `http://localhost:5000`
- QR Table Entry simulation: `http://localhost:3000/table/12`
- Admin Dashboard: `http://localhost:3000/admin`
- Kitchen Command Center: `http://localhost:3000/admin` (Toggle roles in the header switcher!)

---

## ☁️ Production Deployment Guide

### Frontend Deployment: Vercel

1. **Push your code** to GitHub.
2. **Import into Vercel** and select the `/apps/web` root directory.
3. Configure the Framework Preset to **Next.js**.
4. Add Environment Variables:
   - `NEXT_PUBLIC_API_URL`: Your live Railway backend endpoint (e.g. `https://api-production.up.railway.app`).
   - `NEXT_PUBLIC_WS_URL`: Same as above.
5. Deploy!

### Backend Deployment: Railway

1. **Initialize Database & Redis**: Spin up a PostgreSQL and a Redis service in your Railway project workspace.
2. **Add a Web Service**: Link your GitHub repository.
3. Set the **Root Directory** or build command to run the backend:
   - Set Build Command: `npm run build --workspace=apps/server`
   - Set Start Command: `node apps/server/dist/index.js`
4. Bind Environment Variables:
   - `DATABASE_URL`: Linked from your Railway Postgres connection string.
   - `REDIS_URL`: Linked from your Railway Redis connection string.
   - `OPENAI_API_KEY`: Your live production OpenAI key.
   - `PORT`: Automatically managed by Railway.
5. Deploy!

---

## ⚖️ Tradeoffs & Scaling Considerations

- **In-Memory Semantic Vector Store**: Highly optimized for low latency (<30ms) and fits standard restaurant catalog scaling perfectly. For hyper-scale restaurant networks with 10,000+ dishes, moving the cosine index to `pgvector` or `ChromaDB` would reduce RAM footprint.
- **Typewriter Streaming vs Server-Sent Events (SSE)**: We simulate real-time typing on the client-side at word level. This avoids HTTP connection overheads, handles multi-language translations safely in one batch, and maintains sub-second responsiveness.
