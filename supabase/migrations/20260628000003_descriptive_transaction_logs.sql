/*
  # Descriptive Transaction Log Messages

  Updates rpc_hire_freelancer and rpc_release_escrow to include the job title
  and the other party's name in transaction descriptions.
*/

-- 1. Hire Freelancer — include job title + freelancer name in escrow_lock description
CREATE OR REPLACE FUNCTION rpc_hire_freelancer(p_proposal_id uuid)
RETURNS void AS $$
DECLARE
  v_client_id uuid;
  v_freelancer_id uuid;
  v_job_id uuid;
  v_amount numeric;
  v_client_balance numeric;
  v_job_title text;
  v_freelancer_name text;
BEGIN
  SELECT job_id, freelancer_id, proposed_amount INTO v_job_id, v_freelancer_id, v_amount
  FROM proposals WHERE id = p_proposal_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found or already processed.';
  END IF;

  SELECT client_id, title INTO v_client_id, v_job_title
  FROM jobs WHERE id = v_job_id AND status = 'open';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or not open.';
  END IF;

  IF auth.uid() != v_client_id THEN
    RAISE EXCEPTION 'Only the job client can hire the freelancer.';
  END IF;

  SELECT full_name INTO v_freelancer_name FROM users WHERE id = v_freelancer_id;

  SELECT available_balance INTO v_client_balance FROM wallets WHERE user_id = v_client_id FOR UPDATE;

  IF v_client_balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient funds to hire.';
  END IF;

  UPDATE wallets
  SET available_balance = available_balance - v_amount,
      escrow_balance    = escrow_balance    + v_amount
  WHERE user_id = v_client_id;

  UPDATE proposals SET status = 'accepted' WHERE id = p_proposal_id;
  UPDATE proposals SET status = 'rejected' WHERE job_id = v_job_id AND id != p_proposal_id;
  UPDATE jobs SET status = 'in_progress', updated_at = now() WHERE id = v_job_id;

  INSERT INTO hires (job_id, freelancer_id, escrow_amount, status)
  VALUES (v_job_id, v_freelancer_id, v_amount, 'active');

  PERFORM log_transaction(
    v_client_id,
    -v_amount,
    'escrow_lock',
    'Escrow locked · "' || v_job_title || '" (' || v_freelancer_name || ')',
    v_job_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Release Escrow — include job title + client name in escrow_release description
CREATE OR REPLACE FUNCTION rpc_release_escrow(p_job_id uuid)
RETURNS void AS $$
DECLARE
  v_client_id uuid;
  v_freelancer_id uuid;
  v_amount numeric;
  v_hire_status text;
  v_job_title text;
  v_client_name text;
BEGIN
  SELECT client_id, title INTO v_client_id, v_job_title
  FROM jobs WHERE id = p_job_id AND status = 'in_progress';

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

  SELECT full_name INTO v_client_name FROM users WHERE id = v_client_id;

  UPDATE wallets
  SET escrow_balance = escrow_balance - v_amount
  WHERE user_id = v_client_id;

  UPDATE wallets
  SET freelancer_balance = freelancer_balance + v_amount
  WHERE user_id = v_freelancer_id;

  UPDATE hires SET status = 'completed', completed_at = now() WHERE job_id = p_job_id;
  UPDATE jobs SET status = 'completed', updated_at = now() WHERE id = p_job_id;
  UPDATE proposals SET status = 'completed' WHERE job_id = p_job_id AND freelancer_id = v_freelancer_id;

  PERFORM log_transaction(
    v_freelancer_id,
    v_amount,
    'escrow_release',
    'Payment received · "' || v_job_title || '" (' || v_client_name || ')',
    p_job_id
  );

  UPDATE seller_stats
  SET total_jobs_completed = total_jobs_completed + 1, updated_at = now()
  WHERE user_id = v_freelancer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
