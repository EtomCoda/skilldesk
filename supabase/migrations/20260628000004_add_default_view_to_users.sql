/*
  # Add default_view to users

  Stores the role the user selected at signup ('buying' or 'selling') so they
  are always restored to the correct context on login.
*/

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS default_view text NOT NULL DEFAULT 'buying'
  CHECK (default_view IN ('buying', 'selling'));
