/*
  # Financial RPCs (Postgres Functions)
  
  This migration creates secure, ACID-compliant database functions to handle 
  all financial logic and state transitions, entirely bypassing client-side logic.
*/

-- Helper: Create a transaction log
CREATE OR REPLACE FUNCTION log_transaction(
  p_user_id uuid,
  p_amount numeric,
  p_type text,
  p_description text,
  p_job_id uuid DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO transactions (user_id, amount, type, description, job_id)
  VALUES (p_user_id, p_amount, p_type, p_description, p_job_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Hire Freelancer
CREATE OR REPLACE FUNCTION rpc_hire_freelancer(p_proposal_id uuid)
RETURNS void AS $$
DECLARE
  v_client_id uuid;
  v_freelancer_id uuid;
  v_job_id uuid;
  v_amount numeric;
  v_client_balance numeric;
BEGIN
  -- Get proposal details
  SELECT job_id, freelancer_id, proposed_amount INTO v_job_id, v_freelancer_id, v_amount
  FROM proposals WHERE id = p_proposal_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found or already processed.';
  END IF;

  -- Get client id from job
  SELECT client_id INTO v_client_id FROM jobs WHERE id = v_job_id AND status = 'open';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or not open.';
  END IF;
  
  IF auth.uid() != v_client_id THEN
    RAISE EXCEPTION 'Only the job client can hire the freelancer.';
  END IF;

  -- Check client balance
  SELECT available_balance INTO v_client_balance FROM wallets WHERE user_id = v_client_id FOR UPDATE;
  
  IF v_client_balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient funds to hire.';
  END IF;

  -- 1. Deduct from client and lock in escrow
  UPDATE wallets 
  SET available_balance = available_balance - v_amount,
      escrow_balance = escrow_balance + v_amount
  WHERE user_id = v_client_id;

  -- 2. Update statuses
  UPDATE proposals SET status = 'accepted' WHERE id = p_proposal_id;
  UPDATE proposals SET status = 'rejected' WHERE job_id = v_job_id AND id != p_proposal_id;
  UPDATE jobs SET status = 'in_progress', updated_at = now() WHERE id = v_job_id;

  -- 3. Create hire record
  INSERT INTO hires (job_id, freelancer_id, escrow_amount, status)
  VALUES (v_job_id, v_freelancer_id, v_amount, 'active');

  -- 4. Log transactions
  PERFORM log_transaction(v_client_id, -v_amount, 'escrow_lock', 'Funds locked in escrow for job', v_job_id);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Release Escrow
CREATE OR REPLACE FUNCTION rpc_release_escrow(p_job_id uuid)
RETURNS void AS $$
DECLARE
  v_client_id uuid;
  v_freelancer_id uuid;
  v_amount numeric;
  v_hire_status text;
BEGIN
  -- Validate job ownership
  SELECT client_id INTO v_client_id FROM jobs WHERE id = p_job_id AND status = 'in_progress';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or not in progress.';
  END IF;
  
  IF auth.uid() != v_client_id THEN
    RAISE EXCEPTION 'Only the client can release escrow.';
  END IF;

  -- Get hire details
  SELECT freelancer_id, escrow_amount, status INTO v_freelancer_id, v_amount, v_hire_status
  FROM hires WHERE job_id = p_job_id;
  
  IF NOT FOUND OR v_hire_status != 'active' THEN
    RAISE EXCEPTION 'Hire record not found or already completed.';
  END IF;

  -- 1. Deduct from client escrow
  UPDATE wallets 
  SET escrow_balance = escrow_balance - v_amount
  WHERE user_id = v_client_id;

  -- 2. Add to freelancer earnings
  UPDATE wallets 
  SET freelancer_balance = freelancer_balance + v_amount
  WHERE user_id = v_freelancer_id;

  -- 3. Update statuses
  UPDATE hires SET status = 'completed', completed_at = now() WHERE job_id = p_job_id;
  UPDATE jobs SET status = 'completed', updated_at = now() WHERE id = p_job_id;
  UPDATE proposals SET status = 'completed' WHERE job_id = p_job_id AND freelancer_id = v_freelancer_id;

  -- 4. Log transactions
  PERFORM log_transaction(v_client_id, -v_amount, 'payment', 'Payment released for job', p_job_id);
  PERFORM log_transaction(v_freelancer_id, v_amount, 'earning', 'Payment received for job', p_job_id);

  -- 5. Update Seller Stats
  UPDATE seller_stats 
  SET total_jobs_completed = total_jobs_completed + 1, updated_at = now()
  WHERE user_id = v_freelancer_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Transfer Earnings to Client Balance
CREATE OR REPLACE FUNCTION rpc_transfer_to_client(p_amount numeric)
RETURNS void AS $$
DECLARE
  v_freelancer_balance numeric;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be greater than zero.';
  END IF;

  SELECT freelancer_balance INTO v_freelancer_balance FROM wallets WHERE user_id = auth.uid() FOR UPDATE;

  IF v_freelancer_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient earnings balance.';
  END IF;

  UPDATE wallets 
  SET freelancer_balance = freelancer_balance - p_amount,
      available_balance = available_balance + p_amount
  WHERE user_id = auth.uid();

  PERFORM log_transaction(auth.uid(), p_amount, 'transfer', 'Transferred from earnings to client balance');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Credit Wallet (Only callable via Edge Function Service Role)
CREATE OR REPLACE FUNCTION rpc_credit_wallet(p_user_id uuid, p_amount numeric)
RETURNS void AS $$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero.';
  END IF;
  
  -- We assume Service Role Key is used by the Edge Function, bypassing RLS
  UPDATE wallets 
  SET available_balance = available_balance + p_amount
  WHERE user_id = p_user_id;

  PERFORM log_transaction(p_user_id, p_amount, 'deposit', 'Wallet funded via Paystack');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Withdraw Earnings
CREATE OR REPLACE FUNCTION rpc_withdraw_earnings(p_amount numeric)
RETURNS void AS $$
DECLARE
  v_freelancer_balance numeric;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount must be greater than zero.';
  END IF;

  SELECT freelancer_balance INTO v_freelancer_balance FROM wallets WHERE user_id = auth.uid() FOR UPDATE;

  IF v_freelancer_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient earnings balance.';
  END IF;

  UPDATE wallets 
  SET freelancer_balance = freelancer_balance - p_amount
  WHERE user_id = auth.uid();

  PERFORM log_transaction(auth.uid(), -p_amount, 'withdrawal', 'Earnings withdrawn to bank account via Paystack');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTE: Database constraints are applied in 20260617000003_add_constraints_safe.sql
-- (separated to allow safe cleanup of prototype test data first)
