CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    pid uuid DEFAULT gen_random_uuid() UNIQUE,
    name VARCHAR(32) UNIQUE NOT NULL,
    pass TEXT NOT NULL,
    avatar BYTEA NOT NULL,
    email VARCHAR(254) UNIQUE NOT NULL,
    colcoins INT DEFAULT 0,
    prestige INT DEFAULT 0,
    permissions TEXT[] DEFAULT '{"read:activation_token"}',
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    modified_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    author_id INT NOT NULL,
    parent_id INT,
    body TEXT,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES contents(id)
);

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    config JSONB
);

CREATE TABLE IF NOT EXISTS contents_tags (
    content_id INT,
    tag_id INT,
    FOREIGN KEY (content_id) REFERENCES contents(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id),
    PRIMARY KEY (content_id, tag_id)
);

CREATE TABLE IF NOT EXISTS interactions (
    id SERIAL PRIMARY KEY,
    author_id INT NOT NULL,
    content_id INT NOT NULL,
    type TEXT NOT NULL,
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (content_id) REFERENCES contents(id)
);

CREATE TABLE IF NOT EXISTS synonyms (
    id SERIAL PRIMARY KEY,
    title TEXT UNIQUE NOT NULL,
    content_id INT NOT NULL,
    FOREIGN KEY (content_id) REFERENCES contents(id)
);

-- "now() AT TIME ZONE 'utc'" produces a timestamp without time zone, which Postgres then reads
-- back in the server's time zone, storing instants shifted by its UTC offset. These statements
-- fix the defaults of databases created before the correction; they're no-ops afterwards.
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE users ALTER COLUMN modified_at SET DEFAULT now();
ALTER TABLE contents ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE interactions ALTER COLUMN created_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS contents_parent_id_idx ON contents (parent_id);
CREATE INDEX IF NOT EXISTS contents_commit_idx ON contents ((config->>'commit'));
CREATE INDEX IF NOT EXISTS interactions_content_type_idx ON interactions (content_id, type);
CREATE INDEX IF NOT EXISTS interactions_author_content_idx ON interactions (author_id, content_id);

-- A user can react (up or down), bookmark and vote at most once per content. Requests racing
-- each other (e.g. a double click) could previously insert duplicates, so they're removed once,
-- right before the constraints are first created.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'interactions_unique_reaction_idx') THEN
    DELETE FROM interactions a USING interactions b
    WHERE a.author_id = b.author_id
      AND a.content_id = b.content_id
      AND a.id > b.id
      AND (
        (a.type IN ('up', 'down') AND b.type IN ('up', 'down'))
        OR (a.type = b.type AND a.type IN ('bookmark', 'vote'))
      );

    CREATE UNIQUE INDEX interactions_unique_reaction_idx ON interactions (author_id, content_id) WHERE type IN ('up', 'down');
    CREATE UNIQUE INDEX interactions_unique_bookmark_idx ON interactions (author_id, content_id) WHERE type = 'bookmark';
    CREATE UNIQUE INDEX interactions_unique_vote_idx ON interactions (author_id, content_id) WHERE type = 'vote';
  END IF;
END
$$;
