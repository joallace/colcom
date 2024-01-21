CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_text') THEN
        CREATE DOMAIN email_text AS citext CHECK (
            value ~ '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'
        );
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    pid uuid DEFAULT gen_random_uuid() UNIQUE,
    name TEXT UNIQUE NOT NULL,
    pass TEXT NOT NULL,
    email email_text UNIQUE NOT NULL,
    colcoins INT DEFAULT 0,
    prestige INT DEFAULT 0,
    permissions TEXT[] DEFAULT '{"read:activation_token"}',
    config JSON,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE TABLE IF NOT EXISTS contents (
    id SERIAL PRIMARY KEY,
    title TEXT UNIQUE NOT NULL,
    author_id INT NOT NULL,
    parent_id INT,
    body TEXT,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'created',
    config JSON,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES contents(id)
);

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    config JSON
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
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
    valid_until TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (content_id) REFERENCES contents(id)
);

CREATE TABLE IF NOT EXISTS synonyms (
    id SERIAL PRIMARY KEY,
    title TEXT UNIQUE NOT NULL,
    content_id INT NOT NULL,
    FOREIGN KEY (content_id) REFERENCES contents(id)
);