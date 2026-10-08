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

CREATE INDEX IF NOT EXISTS contents_parent_id_idx ON contents (parent_id);
CREATE INDEX IF NOT EXISTS interactions_content_type_idx ON interactions (content_id, type);
CREATE INDEX IF NOT EXISTS interactions_author_content_idx ON interactions (author_id, content_id);

-- A user can react (up or down), bookmark and vote at most once per content
CREATE UNIQUE INDEX IF NOT EXISTS interactions_unique_reaction_idx ON interactions (author_id, content_id) WHERE type IN ('up', 'down');
CREATE UNIQUE INDEX IF NOT EXISTS interactions_unique_bookmark_idx ON interactions (author_id, content_id) WHERE type = 'bookmark';
CREATE UNIQUE INDEX IF NOT EXISTS interactions_unique_vote_idx ON interactions (author_id, content_id) WHERE type = 'vote';

-- Every cast, change and removal of a poll vote. The `vote` interaction only holds a user's current
-- vote, so this is how anyone can audit how a poll moved, and where a post's votes came from.
-- from_content_id is null for a cast, to_content_id for a removal.
CREATE TABLE IF NOT EXISTS vote_events (
    id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    topic_id INT NOT NULL,
    from_content_id INT,
    to_content_id INT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (topic_id) REFERENCES contents(id),
    FOREIGN KEY (from_content_id) REFERENCES contents(id),
    FOREIGN KEY (to_content_id) REFERENCES contents(id),
    CHECK (from_content_id IS DISTINCT FROM to_content_id)
);

CREATE INDEX IF NOT EXISTS vote_events_topic_idx ON vote_events (topic_id, id);

-- The log is written by a trigger on interactions rather than by the API, so every statement that
-- touches a vote row (the API, a future account deletion, an operator's manual SQL) is logged, and
-- in the same transaction as the change itself.
CREATE OR REPLACE FUNCTION vote_topic(post_id INT) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    topic INT;
BEGIN
    SELECT parent_id INTO topic FROM contents WHERE id = post_id AND type = 'post';
    IF topic IS NULL THEN
        RAISE EXCEPTION 'poll votes go on posts, and content % is not one', post_id;
    END IF;
    RETURN topic;
END;
$$;

CREATE OR REPLACE FUNCTION log_vote_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    was_vote BOOLEAN := TG_OP <> 'INSERT' AND OLD.type = 'vote';
    is_vote BOOLEAN := TG_OP <> 'DELETE' AND NEW.type = 'vote';
BEGIN
    IF was_vote AND is_vote AND OLD.author_id = NEW.author_id
       AND vote_topic(OLD.content_id) = vote_topic(NEW.content_id) THEN
        IF OLD.content_id <> NEW.content_id THEN
            INSERT INTO vote_events (user_id, topic_id, from_content_id, to_content_id)
            VALUES (NEW.author_id, vote_topic(NEW.content_id), OLD.content_id, NEW.content_id);
        END IF;
    ELSE
        IF was_vote THEN
            INSERT INTO vote_events (user_id, topic_id, from_content_id, to_content_id)
            VALUES (OLD.author_id, vote_topic(OLD.content_id), OLD.content_id, NULL);
        END IF;
        IF is_vote THEN
            INSERT INTO vote_events (user_id, topic_id, from_content_id, to_content_id)
            VALUES (NEW.author_id, vote_topic(NEW.content_id), NULL, NEW.content_id);
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER interactions_vote_events
    AFTER INSERT OR UPDATE OR DELETE ON interactions
    FOR EACH ROW EXECUTE FUNCTION log_vote_event();

-- Append-only: history can't be edited or erased, not even by the API's own database user
CREATE OR REPLACE FUNCTION reject_vote_event_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'vote_events is append-only: % is not allowed', TG_OP;
END;
$$;

CREATE OR REPLACE TRIGGER vote_events_append_only
    BEFORE UPDATE OR DELETE ON vote_events
    FOR EACH ROW EXECUTE FUNCTION reject_vote_event_change();

CREATE OR REPLACE TRIGGER vote_events_no_truncate
    BEFORE TRUNCATE ON vote_events
    FOR EACH STATEMENT EXECUTE FUNCTION reject_vote_event_change();
