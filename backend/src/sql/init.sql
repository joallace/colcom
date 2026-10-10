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
    -- Signed into every token; raising it revokes all of the user's sessions (POST /logout)
    token_version INT NOT NULL DEFAULT 0,
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

-- Full-text search. `colcom` is Portuguese with accents dropped, so "eleicao" finds "eleição".
-- CREATE TEXT SEARCH CONFIGURATION has no IF NOT EXISTS.
CREATE EXTENSION IF NOT EXISTS unaccent;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'colcom') THEN
        CREATE TEXT SEARCH CONFIGURATION colcom (COPY = portuguese);
        ALTER TEXT SEARCH CONFIGURATION colcom
            ALTER MAPPING FOR hword, hword_part, word WITH unaccent, portuguese_stem;
    END IF;
END;
$$;

-- A first version of search also indexed tag names as words (`tag_names`, and `search` built on it);
-- tags are now searched only as tags (search's `tags`). Remove this once no database predates it.
ALTER TABLE contents DROP COLUMN IF EXISTS tag_names CASCADE;
DROP FUNCTION IF EXISTS refresh_tag_names(INT);
DROP FUNCTION IF EXISTS topic_tag_names(INT);

-- What search reads: a post's `body` is only its summary, so `search_text` holds the plain text of
-- its latest version (written on every commit). Titles weigh more than text.
ALTER TABLE contents ADD COLUMN IF NOT EXISTS search_text TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS search tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('colcom', title), 'A') ||
    setweight(to_tsvector('colcom', COALESCE(search_text, '')), 'D')
) STORED;

CREATE INDEX IF NOT EXISTS contents_search_idx ON contents USING GIN (search);

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

-- Append-only: history can't be edited or erased, not even by the API's own database user.
-- Shared by every log (vote_events, tag_events).
CREATE OR REPLACE FUNCTION reject_log_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE OR REPLACE TRIGGER vote_events_append_only
    BEFORE UPDATE OR DELETE ON vote_events
    FOR EACH ROW EXECUTE FUNCTION reject_log_change();

CREATE OR REPLACE TRIGGER vote_events_no_truncate
    BEFORE TRUNCATE ON vote_events
    FOR EACH STATEMENT EXECUTE FUNCTION reject_log_change();

-- The first schema had a `tags` table without slugs that nothing wrote to; CREATE TABLE IF NOT EXISTS
-- would keep it in existing databases. Remove this once no database predates it.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tags')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'slug') THEN
        DROP TABLE IF EXISTS contents_tags;
        DROP TABLE tags;
    END IF;
END;
$$;

-- Tags. A topic's tags are curated by everyone: the author's first tags are their endorsements, and
-- anyone can endorse or contest a tag, or propose one (an endorsement of a tag the topic doesn't have
-- yet). A tag shows on a topic while it has at least as many endorsements as contests.
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    -- The identity: accents dropped, lowercase, words joined by "-" (tagSlug in shared/)
    slug TEXT UNIQUE NOT NULL,
    -- As its creator wrote it ("Política")
    name TEXT NOT NULL,
    author_id INT NOT NULL,
    -- Merged into another tag (merge_tag): links and filters go there instead
    alias_of INT,
    -- Null while provisional; set by the API once enough topics by distinct authors show it. A
    -- provisional tag that is too old is expired, which queries tell by its age.
    activated_at TIMESTAMP WITH TIME ZONE,
    -- Only the instance applies it (the "meta" tag, src/meta.ts): nobody can propose, endorse or
    -- contest it, so it can't be taken off a foundational topic or put on any other
    reserved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (alias_of) REFERENCES tags(id),
    CHECK (alias_of IS DISTINCT FROM id)
);

-- Databases made before `reserved` existed
ALTER TABLE tags ADD COLUMN IF NOT EXISTS reserved BOOLEAN NOT NULL DEFAULT false;

-- Counting the tags each user created today
CREATE INDEX IF NOT EXISTS tags_author_idx ON tags (author_id, created_at);

-- One vote per user, topic and tag: 1 endorses, -1 contests; withdrawing a vote deletes it
CREATE TABLE IF NOT EXISTS tag_votes (
    content_id INT NOT NULL,
    tag_id INT NOT NULL,
    user_id INT NOT NULL,
    value SMALLINT NOT NULL CHECK (value IN (1, -1)),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    FOREIGN KEY (content_id) REFERENCES contents(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    PRIMARY KEY (content_id, tag_id, user_id)
);

-- Every tag proposed on a topic with its counts, kept by the tag_votes trigger, so lists and filters
-- read one indexed row per tag instead of counting votes
CREATE TABLE IF NOT EXISTS contents_tags (
    content_id INT NOT NULL,
    tag_id INT NOT NULL,
    endorsements INT NOT NULL DEFAULT 0,
    contests INT NOT NULL DEFAULT 0,
    visible BOOLEAN GENERATED ALWAYS AS (endorsements >= 1 AND endorsements >= contests) STORED,
    -- When it was first proposed on the topic
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    FOREIGN KEY (content_id) REFERENCES contents(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id),
    PRIMARY KEY (content_id, tag_id)
);

-- Topics showing a tag: what tag filters (and later search) join
CREATE INDEX IF NOT EXISTS contents_tags_visible_idx ON contents_tags (tag_id, content_id) WHERE visible;

-- Every tag vote cast, changed and withdrawn, so anyone can audit how a topic's tags came to be.
-- from_value is null for a new vote, to_value for a withdrawn one.
CREATE TABLE IF NOT EXISTS tag_events (
    id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    content_id INT NOT NULL,
    tag_id INT NOT NULL,
    from_value SMALLINT,
    to_value SMALLINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (content_id) REFERENCES contents(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id),
    CHECK (from_value IS DISTINCT FROM to_value)
);

CREATE INDEX IF NOT EXISTS tag_events_content_idx ON tag_events (content_id, id);

-- Like the vote log, written by a trigger so any statement on tag_votes is logged and counted in
-- its own transaction
CREATE OR REPLACE FUNCTION apply_tag_vote() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    vote tag_votes := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
BEGIN
    IF TG_OP = 'UPDATE' AND (OLD.content_id, OLD.tag_id, OLD.user_id) IS DISTINCT FROM (NEW.content_id, NEW.tag_id, NEW.user_id) THEN
        RAISE EXCEPTION 'a tag vote can only change its value';
    END IF;
    IF TG_OP = 'INSERT' AND NOT EXISTS (SELECT 1 FROM contents WHERE id = NEW.content_id AND type = 'topic') THEN
        RAISE EXCEPTION 'tags go on topics, and content % is not one', NEW.content_id;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.value = NEW.value THEN
        RETURN NULL;
    END IF;

    INSERT INTO tag_events (user_id, content_id, tag_id, from_value, to_value)
    VALUES (
        vote.user_id, vote.content_id, vote.tag_id,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.value END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.value END
    );

    -- Locks the row first, so concurrent votes on one tag wait for each other and each recount (a
    -- new statement, so a new snapshot) sees the votes committed before it
    INSERT INTO contents_tags (content_id, tag_id) VALUES (vote.content_id, vote.tag_id) ON CONFLICT DO NOTHING;
    PERFORM 1 FROM contents_tags WHERE content_id = vote.content_id AND tag_id = vote.tag_id FOR UPDATE;

    UPDATE contents_tags SET
        endorsements = (SELECT COUNT(*) FROM tag_votes WHERE content_id = vote.content_id AND tag_id = vote.tag_id AND value = 1),
        contests = (SELECT COUNT(*) FROM tag_votes WHERE content_id = vote.content_id AND tag_id = vote.tag_id AND value = -1)
    WHERE content_id = vote.content_id AND tag_id = vote.tag_id;

    -- A tag nobody votes for anymore is no longer proposed
    DELETE FROM contents_tags
    WHERE content_id = vote.content_id AND tag_id = vote.tag_id AND endorsements = 0 AND contests = 0;

    RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER tag_votes_apply
    AFTER INSERT OR UPDATE OR DELETE ON tag_votes
    FOR EACH ROW EXECUTE FUNCTION apply_tag_vote();

CREATE OR REPLACE TRIGGER tag_events_append_only
    BEFORE UPDATE OR DELETE ON tag_events
    FOR EACH ROW EXECUTE FUNCTION reject_log_change();

CREATE OR REPLACE TRIGGER tag_events_no_truncate
    BEFORE TRUNCATE ON tag_events
    FOR EACH STATEMENT EXECUTE FUNCTION reject_log_change();

-- For the instance's operator: merges a duplicate tag into another (SELECT merge_tag('eleicao',
-- 'eleicoes')). Its votes move over, logged as withdrawn from one and cast on the other, except where
-- the voter already voted on the other; then it becomes an alias, which links and filters follow.
CREATE OR REPLACE FUNCTION merge_tag(duplicate TEXT, target TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    from_id INT := (SELECT id FROM tags WHERE slug = duplicate);
    into_id INT := (SELECT id FROM tags WHERE slug = target AND alias_of IS NULL);
    moved tag_votes;
BEGIN
    IF from_id IS NULL OR into_id IS NULL OR from_id = into_id THEN
        RAISE EXCEPTION 'merge_tag needs two different tags, the second not an alias';
    END IF;

    FOR moved IN DELETE FROM tag_votes WHERE tag_id = from_id RETURNING * LOOP
        INSERT INTO tag_votes (content_id, tag_id, user_id, value)
        VALUES (moved.content_id, into_id, moved.user_id, moved.value)
        ON CONFLICT DO NOTHING;
    END LOOP;

    UPDATE tags SET alias_of = into_id WHERE id = from_id OR alias_of = from_id;
END;
$$;

-- On-site notifications: what someone did that the recipient has to know about (a critique or a
-- suggestion on their post, an answer to their suggestion…). Written by the API after the action's
-- write succeeded. `content_id` is what it is about (the post, the topic), `subject_id` what was
-- made (the critique, the new post, the clone) and `interaction_id` the suggestion, when there is one.
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    actor_id INT NOT NULL,
    type TEXT NOT NULL,
    content_id INT NOT NULL,
    subject_id INT,
    interaction_id INT,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (actor_id) REFERENCES users(id),
    -- Contents and suggestions are only deleted when their git write fails (withRollback)
    FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES contents(id) ON DELETE CASCADE,
    FOREIGN KEY (interaction_id) REFERENCES interactions(id) ON DELETE CASCADE,
    -- No one is told about what they did themselves
    CHECK (user_id <> actor_id)
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, id DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
