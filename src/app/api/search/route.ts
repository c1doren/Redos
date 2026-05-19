import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/db';
import { posts } from '@/db/schema';
import { and, gte, inArray, sql } from 'drizzle-orm';
import { getEmbedding } from '@/utils/embeddings';
import Sentiment from 'sentiment';

const LOCAL_DB_PATH = path.join(process.cwd(), 'src/db/local_db.json');

function getCosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function searchLocalDb(queryVector: number[], subreddits?: string[], minScore?: number, dateFrom?: string): any[] {
  try {
    if (!fs.existsSync(LOCAL_DB_PATH)) return [];
    const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    const localPosts = JSON.parse(data) || [];

    let filtered = localPosts;

    if (subreddits && subreddits.length > 0) {
      filtered = filtered.filter((p: any) => subreddits.includes(p.subreddit));
    }

    if (minScore !== undefined && minScore !== null) {
      filtered = filtered.filter((p: any) => p.score >= minScore);
    }

    if (dateFrom) {
      const boundary = new Date(dateFrom).getTime();
      filtered = filtered.filter((p: any) => new Date(p.createdAt).getTime() >= boundary);
    }

    const scored = filtered.map((post: any) => ({
      id: post.id,
      title: post.title,
      body: post.body,
      url: post.url,
      subreddit: post.subreddit,
      score: post.score,
      createdAt: post.createdAt,
      similarity: getCosineSimilarity(post.embedding || [], queryVector) * 100,
    }));

    scored.sort((a: any, b: any) => b.similarity - a.similarity);
    return scored.slice(0, 40);
  } catch (err) {
    console.error('Failed to read local DB:', err);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const { query, subreddits, minScore, sentiment, dateFrom, useLocalDb, globalSearch, minSimilarity } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const queryVector = await getEmbedding(query);
    let results: any[] = [];
    const activeSubreddits = globalSearch ? undefined : subreddits;
    const threshold = minSimilarity !== undefined ? Number(minSimilarity) : 35;

    if (useLocalDb) {
      results = searchLocalDb(queryVector, activeSubreddits, minScore, dateFrom);
    } else {
      const filters = [];

      if (activeSubreddits && activeSubreddits.length > 0) {
        filters.push(inArray(posts.subreddit, activeSubreddits));
      }

      if (minScore !== undefined && minScore !== null) {
        filters.push(gte(posts.score, minScore));
      }

      if (dateFrom) {
        filters.push(gte(posts.createdAt, new Date(dateFrom)));
      }

      try {
        results = await db
          .select({
            id: posts.id,
            title: posts.title,
            body: posts.body,
            url: posts.url,
            subreddit: posts.subreddit,
            score: posts.score,
            createdAt: posts.createdAt,
            similarity: sql<number>`(1 - (${posts.embedding} <=> ${queryVector})) * 100`,
          })
          .from(posts)
          .where(filters.length > 0 ? and(...filters) : undefined)
          .orderBy(sql`${posts.embedding} <=> ${queryVector}`)
          .limit(40);
      } catch (dbErr) {
        console.error('PostgreSQL query failed, falling back to Local JSON DB:', dbErr);
        results = searchLocalDb(queryVector, activeSubreddits, minScore, dateFrom);
      }
    }

    const sentimentAnalyzer = new Sentiment();

    const processed = results.map(post => {
      const textToAnalyze = `${post.title} ${post.body}`;
      const score = sentimentAnalyzer.analyze(textToAnalyze).score;
      const label = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
      
      return {
        ...post,
        sentiment: label,
      };
    });

    const filtered = sentiment
      ? processed.filter(post => post.sentiment === sentiment)
      : processed;

    const finalFiltered = filtered.filter(post => post.similarity >= threshold);

    return NextResponse.json(finalFiltered.slice(0, 20));
  } catch (err) {
    console.error('Search API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
