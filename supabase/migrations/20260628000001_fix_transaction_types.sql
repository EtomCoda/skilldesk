/*
  # Fix Transaction Type Mismatches

  rpc_release_escrow was logging 'payment' (client) and 'earning' (freelancer).
  rpc_transfer_to_client was logging 'transfer'.
  None of these matched the Wallet.tsx type filters or the Transaction TS interface.

  Fixes:
  - Remove redundant client log in rpc_release_escrow (client already sees escrow_lock)
  - Change freelancer log: 'earning' → 'escrow_release'
  - Change rpc_transfer_to_client: 'transfer' → 'transfer_to_client'
*/

CREATE OR REPLACE FUNCTION rpc_release_escrow(p_job_id uuid)
RETURNS void AS $$
DECLARE
  v_client_id uuid;
  v_freelancer_id uuid;
  v_amount numeric;
  v_hire_status text;
BEGIN
  SELECT client_id INTO v_client_id FROM jobs WHERE id = p_job_id AND status = 'in_progress';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or not in progress.';
  END IF;

  IF auth.uid() != v_client_id THEN
    RAISE EXCEPTION 'Only the client can release escrow.';
  END IF;

  SELECT freelancer_id, escrow_amount, status INTO v_freelancer_id, v_amount, v_hire_status
  FROM hires WHERE job_id = p_job_id;

  IF NOT FOUND OR v_hire_status != 'active' THEN
    RAISE EXCEPTION 'Hire record not found or already completed.';
  END IF;

  -- Deduct from client escrow
  UPDATE wallets
  SET escrow_balance = escrow_balance - v_amount
  WHERE user_id = v_client_id;

  -- Credit freelancer earnings
  UPDATE wallets
  SET freelancer_balance = freelancer_balance + v_amount
  WHERE user_id = v_freelancer_id;

  -- Update statuses
  UPDATE hires SET status = 'completed', completed_at = now() WHERE job_id = p_job_id;
  UPDATE jobs SET status = 'completed', updated_at = now() WHERE id = p_job_id;
  UPDATE proposals SET status = 'completed' WHERE job_id = p_job_id AND freelancer_id = v_freelancer_id;

  -- Log only for freelancer — client already has escrow_lock from hire
  PERFORM log_transaction(v_freelancer_id, v_amount, 'escrow_release', 'Payment received for completed job', p_job_id);

  -- Update seller stats
  UPDATE seller_stats
  SET total_jobs_completed = total_jobs_completed + 1, updated_at = now()
  WHERE user_id = v_freelancer_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


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
      available_balance  = available_balance  + p_amount
  WHERE user_id = auth.uid();

  PERFORM log_transaction(auth.uid(), p_amount, 'transfer_to_client', 'Transferred from earnings to client wallet');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
