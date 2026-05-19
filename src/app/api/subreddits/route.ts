import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/db';
import { posts } from '@/db/schema';
import { sql } from 'drizzle-orm';

const LOCAL_DB_PATH = path.join(process.cwd(), 'src/db/local_db.json');

function getSubredditsFromLocal(): any[] {
  try {
    if (!fs.existsSync(LOCAL_DB_PATH)) return [];
    const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    const localPosts = JSON.parse(data) || [];

    const counts: Record<string, number> = {};
    for (const post of localPosts) {
      const sub = post.subreddit || 'unknown';
      counts[sub] = (counts[sub] || 0) + 1;
    }

    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
    }));
  } catch (err) {
    console.error('Failed to read subreddits from local DB:', err);
    return [];
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const useLocalDb = searchParams.get('useLocalDb') === 'true';

    if (useLocalDb) {
      return NextResponse.json(getSubredditsFromLocal());
    }

    try {
      const results = await db
        .select({
          name: posts.subreddit,
          count: sql<number>`count(${posts.id})::int`,
        })
        .from(posts)
        .groupBy(posts.subreddit);

      return NextResponse.json(results);
    } catch (dbErr) {
      console.error('PostgreSQL query failed, falling back to Local JSON DB:', dbErr);
      return NextResponse.json(getSubredditsFromLocal());
    }
  } catch (err) {
    console.error('Subreddits API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
