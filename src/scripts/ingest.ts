import 'dotenv/config';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { posts } from '../db/schema';
import { inArray } from 'drizzle-orm';
import { getEmbedding } from '../utils/embeddings';

const SUBREDDITS = ['webdev', 'DataHoarder', 'personalfinance'];
const LOCAL_DB_PATH = path.join(process.cwd(), 'src/db/local_db.json');

function getLocalPosts(): any[] {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      return JSON.parse(data) || [];
    }
  } catch {}
  return [];
}

function saveLocalPosts(postsList: any[]) {
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(postsList, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save to local JSON DB:', err);
  }
}

async function fetchSubmissions(subreddit: string): Promise<any[]> {
  try {
    const res = await fetch(`https://api.pullpush.io/reddit/search/submission/?subreddit=${subreddit}&size=20`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

async function fetchComments(postId: string): Promise<any[]> {
  try {
    const res = await fetch(`https://api.pullpush.io/reddit/search/comment/?link_id=t3_${postId}&size=5`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

async function runIngestion() {
  console.log('Starting ingestion pipeline...');
  
  const localPosts = getLocalPosts();
  const localIds = new Set(localPosts.map(p => p.id));
  
  for (const subreddit of SUBREDDITS) {
    console.log(`Fetching posts for r/${subreddit}...`);
    const submissions = await fetchSubmissions(subreddit);
    if (!submissions.length) {
      console.log(`No submissions found or API down for r/${subreddit}`);
      continue;
    }

    const postIds = submissions.map(p => p.id);
    let existingIds = new Set<string>();

    try {
      const existing = await db.select({ id: posts.id }).from(posts).where(inArray(posts.id, postIds));
      existingIds = new Set(existing.map(p => p.id));
    } catch {
      console.log('PostgreSQL database not reachable. Relying on local JSON DB for deduplication.');
    }

    const newSubmissions = submissions.filter(p => !existingIds.has(p.id) && !localIds.has(p.id));
    console.log(`Found ${newSubmissions.length} new posts out of ${submissions.length} total for r/${subreddit}`);

    for (const post of newSubmissions) {
      try {
        const comments = await fetchComments(post.id);
        const commentsText = comments.map(c => c.body || '').join('\n');
        
        const combinedText = `Title: ${post.title || ''}\nBody: ${post.selftext || ''}\nComments: ${commentsText}`;
        const embeddingVector = await getEmbedding(combinedText);

        const newPostRecord = {
          id: post.id,
          title: post.title || '[No Title]',
          body: post.selftext || '',
          url: post.url || `https://reddit.com/r/${post.subreddit}/comments/${post.id}`,
          subreddit: post.subreddit,
          score: post.score || 0,
          createdAt: new Date((post.created_utc || Date.now() / 1000) * 1000).toISOString(),
          embedding: embeddingVector,
        };

        localPosts.push(newPostRecord);
        localIds.add(post.id);
        saveLocalPosts(localPosts);

        try {
          await db.insert(posts).values({
            id: post.id,
            title: post.title || '[No Title]',
            body: post.selftext || '',
            url: post.url || `https://reddit.com/r/${post.subreddit}/comments/${post.id}`,
            subreddit: post.subreddit,
            score: post.score || 0,
            createdAt: new Date((post.created_utc || Date.now() / 1000) * 1000),
            embedding: embeddingVector,
          });
        } catch {}

        console.log(`Ingested post: ${post.id} - ${post.title.substring(0, 40)}...`);
      } catch (err) {
        console.error(`Failed to ingest post ${post.id}:`, err);
      }
    }
  }
  
  console.log('Ingestion pipeline completed.');
}

if (process.argv.includes('--now')) {
  runIngestion().then(() => process.exit(0)).catch(err => {
    console.error('Fatal ingestion error:', err);
    process.exit(1);
  });
} else {
  cron.schedule('0 */6 * * *', () => {
    runIngestion().catch(err => console.error('Cron Ingestion error:', err));
  });
  console.log('Cron job scheduled: Ingestion will run every 6 hours.');
}
