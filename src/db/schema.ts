import { pgTable, text, varchar, integer, timestamp, vector, index } from 'drizzle-orm/pg-core';

export const posts = pgTable('posts', {
  id: varchar('id', { length: 32 }).primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  url: text('url').notNull(),
  subreddit: varchar('subreddit', { length: 64 }).notNull(),
  score: integer('score').notNull(),
  createdAt: timestamp('created_at').notNull(),
  embedding: vector('embedding', { dimensions: 384 }).notNull(),
}, (table) => [
  index('embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);
