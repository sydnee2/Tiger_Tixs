PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT    NOT NULL,
  date    TEXT    NOT NULL,            -- store as 'YYYY-MM-DD'
  tickets INTEGER NOT NULL CHECK (tickets >= 0)
);

-- Only insert events if the table is empty
INSERT OR IGNORE INTO events (id, name, date, tickets) VALUES
  (1, 'Clemson Tigers Football Game', '2025-12-15', 100),
  (2, 'Clemson Basketball Homecoming', '2025-12-20', 100),
  (3, 'Clemson Tiger Paw 5K Run', '2026-01-10', 100),
  (4, 'Clemson Academic Excellence Symposium', '2026-01-25', 100),
  (5, 'Clemson Engineering Innovation Expo', '2026-02-05', 100),
  (6, 'Clemson Spring Concert at Amphitheater', '2026-03-15', 100);
