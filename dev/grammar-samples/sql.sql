-- SQLite 3.38+ highlighting sample for Cassidy Dark Dev; inspect as source.
-- Optional validation: sqlite3 :memory: < dev/grammar-samples/sql.sql
-- All objects are temporary to the in-memory connection; the transaction rolls back.
/* Block comment: SELECT "identifiers", 'strings', and punctuation stay comments. */

BEGIN TRANSACTION;

CREATE TABLE "swatches" (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    color TEXT NOT NULL DEFAULT '#92c1fd' CHECK (color LIKE '#%'),
    opacity REAL DEFAULT 1.0 CHECK (opacity BETWEEN 0 AND 1),
    enabled INTEGER NOT NULL DEFAULT TRUE,
    metadata TEXT DEFAULT '{}',
    label TEXT GENERATED ALWAYS AS (name || '=' || color) VIRTUAL,
    parent_id INTEGER REFERENCES swatches(id) ON DELETE SET NULL
);

CREATE TABLE audit (id INTEGER PRIMARY KEY, message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX active_swatches ON swatches(enabled, name DESC) WHERE enabled = TRUE;
CREATE VIEW visible_swatches AS SELECT id, name, color FROM swatches WHERE enabled = TRUE;

CREATE TRIGGER log_swatch AFTER INSERT ON swatches
BEGIN
    INSERT INTO audit(message) VALUES ('Inserted ' || NEW.name);
END;

INSERT INTO swatches(id, name, color, opacity, metadata) VALUES
    (1, 'accent', '#92c1fd', 1.0, '{"role":"primary","tags":["blue","bright"]}'),
    (2, 'surface', '#242424', 0.95, '{"role":"background"}'),
    (3, 'reader''s choice', '#cfabf9', 7.5e-1, NULL);

INSERT INTO swatches(id, name, color) VALUES (1, 'accent', '#92c1fd')
ON CONFLICT(id) DO UPDATE SET color = excluded.color
RETURNING id, name, color;

SELECT
    42 AS integer_literal,
    -42 AS negative_literal,
    0xFF AS hex_literal,
    3.14159 AS fraction,
    6.022e23 AS exponent,
    X'CAFE' AS blob_literal,
    TRUE AS enabled,
    FALSE AS disabled,
    NULL AS missing,
    'Unicode café 日本語 🚀' AS unicode_text,
    'quotes ''inside'' strings' AS escaped_quote,
    "name" AS "quoted alias",
    `color` AS `backtick alias`,
    [opacity] AS [bracket alias]
FROM swatches;

SELECT s.id, s.name, parent.name AS parent_name,
    CASE WHEN s.opacity >= 0.9 THEN 'opaque' WHEN s.opacity > 0 THEN 'translucent' ELSE 'invisible' END AS kind,
    COALESCE(s.metadata, '{}') AS metadata,
    NULLIF(s.name, '') AS nonempty_name,
    CAST(s.opacity * 100 AS INTEGER) AS percentage,
    LENGTH(s.name) AS name_length,
    UPPER(SUBSTR(s.name, 1, 3)) AS abbreviation
FROM swatches AS s
LEFT JOIN swatches AS parent ON parent.id = s.parent_id
WHERE s.enabled IS TRUE
    AND s.name NOT IN ('hidden', 'removed')
    AND s.opacity BETWEEN 0.5 AND 1.0
    AND (s.color LIKE '#92%' OR s.name GLOB 's*')
    AND s.metadata IS NOT NULL
ORDER BY s.opacity DESC, s.name ASC
LIMIT 10 OFFSET 0;

WITH ranked AS (
    SELECT name, opacity,
        ROW_NUMBER() OVER (ORDER BY opacity DESC) AS position,
        RANK() OVER (ORDER BY opacity DESC) AS rank,
        LAG(opacity, 1, 0) OVER (ORDER BY id) AS previous,
        SUM(opacity) OVER (ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total
    FROM swatches
)
SELECT * FROM ranked WHERE position <= 3;

WITH RECURSIVE sequence(value) AS (
    SELECT 1
    UNION ALL
    SELECT value + 1 FROM sequence WHERE value < 5
)
SELECT value, value * value AS square FROM sequence;

SELECT enabled, COUNT(*) AS total, AVG(opacity) AS average_opacity, MIN(name), MAX(name)
FROM swatches
GROUP BY enabled
HAVING COUNT(*) > 0;

SELECT name FROM swatches WHERE EXISTS (SELECT 1 FROM audit WHERE audit.message LIKE '%' || swatches.name)
UNION
SELECT 'fallback'
EXCEPT
SELECT 'hidden';

SELECT name FROM swatches INTERSECT SELECT name FROM visible_swatches;
SELECT a.name, b.name FROM swatches AS a CROSS JOIN swatches AS b WHERE a.id <> b.id;
SELECT 1 + 2 - 3 * 4 / 2 % 5, ~10 & 15 | 2, 1 << 3, 8 >> 1, 1 = 1, 1 != 2, 1 <> 2, NOT FALSE;
SELECT json_extract(metadata, '$.role'), metadata -> '$.tags', metadata ->> '$.role' FROM swatches;
SELECT :named_parameter, @alternate_parameter, $dollar_parameter, ?1;

SAVEPOINT preview;
UPDATE swatches SET opacity = opacity - 0.1 WHERE id = 2 RETURNING name, opacity;
DELETE FROM swatches WHERE id = 3 RETURNING id;
ROLLBACK TO preview;
RELEASE preview;

EXPLAIN QUERY PLAN SELECT * FROM swatches WHERE enabled = TRUE ORDER BY name;
DROP VIEW visible_swatches;
DROP TRIGGER log_swatch;
DROP INDEX active_swatches;

ROLLBACK;
