# Redos — Semantic Reddit Search

Created by **c1doren**.

Redos is a Reddit search engine that queries by intent and concept rather than exact keywords. For example, searching for "fix rusty cast iron" will find threads about "restoring old skillets" even if the word "rusty" is never mentioned.

It features a high-contrast, interactive black-and-white glassmorphism UI, a custom calendar with presets, and runs its AI embeddings 100% locally.

---

## How it works

1. **Local Embeddings**: Merges the post's title, body, and top comments, then encodes them into a 384-dimensional vector using `@huggingface/transformers` running the `all-MiniLM-L6-v2` ONNX model locally. No external APIs or costs.
2. **On-Demand Syncing**: Enter any subreddit in the UI. If it's new, a background worker pulls the latest 15 submissions and top comments from the Pullpush API, embeds them on the fly, and indexes them.
3. **Flexible Storage**: Supports running with zero setup using **Local JSON** (in-memory cosine similarity search) or **PostgreSQL** (using Drizzle ORM and `pgvector` with HNSW index).
4. **Smart Filters**: Includes a strictness relevance slider, custom preset calendar, and sentiment analysis (Positive/Neutral/Negative classification via AFINN lexicon).

---

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Vanilla CSS with glassmorphic styles and interactive mouse-tracking grain canvas
- **Database**: Local JSON file / Postgres with pgvector and Drizzle ORM
- **Embeddings**: HuggingFace transformers.js (`all-MiniLM-L6-v2` ONNX)

---

## Getting Started

Make sure you have Node.js (v18+) installed.

### 1. Install dependencies
```bash
npm install
```

### 2. Fetch initial data
Fetch and embed some initial posts into the local JSON file:
```bash
npx tsx src/scripts/ingest.ts --now
```

### 3. Run the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Using PostgreSQL (Optional)

If you want to use a real database instead of the local JSON mode:

1. Spin up a Postgres database and enable the `vector` extension.
2. Add your connection string to `.env.local`:
   ```env
   DATABASE_URL="postgresql://user:pass@localhost:5432/redos"
   ```
3. Push the schema:
   ```bash
   npx drizzle-kit push
   ```
4. Flip the engine switch in the header to **PostgreSQL**.

---

## Project Structure

```text
├── drizzle/                    # Drizzle migrations
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ingest/         # POST dynamic subreddit sync
│   │   │   ├── search/         # POST semantic search endpoint
│   │   │   └── subreddits/     # GET available subreddits & counts
│   │   ├── globals.css         # Glassmorphic styles & animations
│   │   ├── layout.tsx          # Next.js main layout
│   │   └── page.tsx            # Main Search UI & Canvas Background
│   ├── db/
│   │   ├── index.ts            # DB connection client
│   │   ├── schema.ts           # Drizzle schema (pgvector & HNSW index)
│   │   └── local_db.json       # Local JSON database file
│   ├── types/
│   │   └── sentiment.d.ts      # Sentiment type declarations
│   ├── scripts/
│   │   └── ingest.ts           # Cron pipeline and initial seed script
│   └── utils/
│       └── embeddings.ts       # ONNX embedding model singleton
├── drizzle.config.ts           # Drizzle configuration
└── package.json
```
