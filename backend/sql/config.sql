CREATE EXTENSION IF NOT EXISTS citext;

CREATE DOMAIN IF NOT EXISTS email_text AS citext CHECK (
    value ~ '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'
);

CREATE TABLE IF NOT EXISTS users (
    pk SERIAL PRIMARY KEY,
    id uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    nick TEXT UNIQUE NOT NULL,
    pass TEXT NOT NULL,
    email email_text UNIQUE NOT NULL,
    colcoins INT DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
);

CREATE TABLE IF NOT EXISTS topics (
    pk SERIAL PRIMARY KEY,
    id uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    title TEXT UNIQUE NOT NULL,
    author_id SERIAL NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
    FOREIGN KEY (author_id) REFERENCES users(pk)
);

CREATE TABLE IF NOT EXISTS tags (
    pk SERIAL PRIMARY KEY,
    id uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    title TEXT UNIQUE NOT NULL,
    style JSON
);

CREATE TABLE IF NOT EXISTS votes (
    pk SERIAL PRIMARY KEY,
    user_id SERIAL NOT NULL,
    topic_id SERIAL NOT NULL,
    vote_type ENUM('up', 'down') NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(pk),
    FOREIGN KEY (topic_id) REFERENCES topics(pk)
);

CREATE TABLE IF NOT EXISTS synonyms (
    pk SERIAL PRIMARY KEY,
    title TEXT UNIQUE NOT NULL,
    topic_id SERIAL NOT NULL,
    FOREIGN KEY (topic_id) REFERENCES topics(pk)
);