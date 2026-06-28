/*
  # Add reviewer_is_client to reviews

  Tracks whether the reviewer was acting as a client or freelancer at the time
  of the review. Used to display context on profile pages ("Client review" vs
  "Freelancer review").

  Defaults to NULL for existing rows since we can't retroactively determine it.
*/

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS reviewer_is_client boolean;
