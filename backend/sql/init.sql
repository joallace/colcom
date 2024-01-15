CREATE EXTENSION IF NOT EXISTS citext;

CREATE DOMAIN IF NOT EXISTS email_text AS citext CHECK (
    value ~ '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    pid uuid DEFAULT gen_random_uuid() UNIQUE,
    nick TEXT UNIQUE NOT NULL,
    pass TEXT NOT NULL,
    email email_text UNIQUE NOT NULL,
    colcoins INT DEFAULT 0,
    permissions TEXT[] DEFAULT '{"read:activation_token"}',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
);

CREATE TABLE IF NOT EXISTS contents (
    id SERIAL PRIMARY KEY,
    pid uuid DEFAULT gen_random_uuid() UNIQUE,
    title TEXT UNIQUE NOT NULL,
    author_id SERIAL NOT NULL,
    parent_id SERIAL,
    body TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES contents(id)
);

CREATE TABLE IF NOT EXISTS critiques (
    id SERIAL PRIMARY KEY,
    pid uuid DEFAULT gen_random_uuid() UNIQUE,
    title TEXT UNIQUE NOT NULL,
    author_id SERIAL NOT NULL,
    parent_id SERIAL NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
    commit TEXT NOT NULL,
    from INT NOT NULL,
    to INT NOT NULL,
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES contents(id)
);

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    pid uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    title TEXT UNIQUE NOT NULL,
    style JSON
);

CREATE TABLE IF NOT EXISTS contents_tags (
    content_id SERIAL PRIMARY KEY,
    tag_id SERIAL PRIMARY KEY,
    FOREIGN KEY (content_id) REFERENCES contents(id)
    FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE IF NOT EXISTS interactions (
    id SERIAL PRIMARY KEY,
    user_id SERIAL NOT NULL,
    content_id SERIAL,
    type TEXT NOT NULL, -- ('up', 'down', 'favorite', 'bookmark')
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (content_id) REFERENCES contents(id)
);

CREATE TABLE IF NOT EXISTS promotions (
    id SERIAL PRIMARY KEY,
    user_id SERIAL NOT NULL,
    content_id SERIAL NOT NULL,
    amount INT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
    valid_until TIMESTAMP WITHOUT TIME ZONE DEFAULT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (content_id) REFERENCES contents(id)
);

CREATE TABLE IF NOT EXISTS synonyms (
    id SERIAL PRIMARY KEY,
    title TEXT UNIQUE NOT NULL,
    content_id SERIAL NOT NULL,
    FOREIGN KEY (content_id) REFERENCES contents(id)
);