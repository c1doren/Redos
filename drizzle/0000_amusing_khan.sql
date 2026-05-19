CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"url" text NOT NULL,
	"subreddit" varchar(64) NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"embedding" vector(384) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "embedding_idx" ON "posts" USING hnsw ("embedding" vector_cosine_ops);