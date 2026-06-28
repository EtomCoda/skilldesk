/*
  # Secure RLS Policies
  
  This migration revokes all overly permissive policies and institutes strict access control.
*/

-- 1. Wallets: Drop insecure update policy
DROP POLICY IF EXISTS "Anyone can update own wallet" ON wallets;
-- (The original SELECT "Users can view their own wallet" ON wallets should remain or be recreated)
DROP POLICY IF EXISTS "Users can view their own wallet" ON wallets;
CREATE POLICY "Users can view their own wallet"
  ON wallets FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Hires: Drop insecure mutation policies
DROP POLICY IF EXISTS "Anyone can insert hires" ON hires;
DROP POLICY IF EXISTS "Anyone can update hires" ON hires;
-- Ensure SELECT is permitted
DROP POLICY IF EXISTS "Users can view their hires" ON hires;
CREATE POLICY "Users can view their hires"
  ON hires FOR SELECT
  USING (true); -- Publicly viewable for verification, mutations restricted to system (RPC)

-- 3. Proposals: Secure mutations
DROP POLICY IF EXISTS "Anyone can insert proposals" ON proposals;
DROP POLICY IF EXISTS "Anyone can update proposals" ON proposals;

CREATE POLICY "Freelancers can insert proposals"
  ON proposals FOR INSERT
  WITH CHECK (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can update own proposals"
  ON proposals FOR UPDATE
  USING (auth.uid() = freelancer_id AND status = 'pending')
  WITH CHECK (auth.uid() = freelancer_id);

-- 4. Transactions: Drop insecure insert
DROP POLICY IF EXISTS "Anyone can insert transactions" ON transactions;
-- Transactions should only be inserted by RPCs. Users can SELECT their own.
DROP POLICY IF EXISTS "Users can view their transactions" ON transactions;
CREATE POLICY "Users can view their transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

-- 5. Reviews: Restrict inserts to completed jobs only
DROP POLICY IF EXISTS "Anyone can create reviews" ON reviews;
CREATE POLICY "Participants can review completed jobs"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id AND 
    EXISTS (
      SELECT 1 FROM hires 
      WHERE hires.job_id = reviews.job_id 
        AND hires.status = 'completed'
        AND (hires.freelancer_id = auth.uid() OR EXISTS (SELECT 1 FROM jobs WHERE jobs.id = hires.job_id AND jobs.client_id = auth.uid()))
    )
  );

-- 6. Seller Stats: Restrict to system
DROP POLICY IF EXISTS "System can manage stats" ON seller_stats;
DROP POLICY IF EXISTS "System can update stats" ON seller_stats;
-- (Mutations now strictly reserved for postgres functions bypassing RLS)

-- 7. Direct Messages: Lock down
DROP POLICY IF EXISTS "Anyone can create a direct conversation" ON direct_conversations;
CREATE POLICY "Users can create direct conversation"
  ON direct_conversations FOR INSERT
  WITH CHECK (auth.uid() = participant_a OR auth.uid() = participant_b);

DROP POLICY IF EXISTS "Participants can send direct messages" ON direct_messages;
CREATE POLICY "Participants can send direct messages"
  ON direct_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
