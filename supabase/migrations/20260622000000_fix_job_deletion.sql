-- Fix Job Deletion
-- Allows Admins and Job Owners to delete jobs and refunds any active escrow.

-- 1. RLS Policy for DELETE on jobs
CREATE POLICY "Admins and Job Owners can delete jobs"
ON jobs
FOR DELETE
USING (
  auth.uid() = client_id OR 
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)
);

-- 2. Trigger to refund escrow before job deletion
CREATE OR REPLACE FUNCTION refund_escrow_on_job_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_escrow_amount numeric;
BEGIN
  -- Check if there's an active hire for this job
  SELECT escrow_amount INTO v_escrow_amount FROM hires WHERE job_id = OLD.id AND status = 'active';
  
  IF FOUND THEN
    -- Refund the client's wallet
    UPDATE wallets
    SET escrow_balance = escrow_balance - v_escrow_amount,
        available_balance = available_balance + v_escrow_amount
    WHERE user_id = OLD.client_id;
    
    -- Log the refund
    INSERT INTO transactions (user_id, amount, type, description, job_id)
    VALUES (OLD.client_id, v_escrow_amount, 'refund', 'Escrow refunded due to job deletion', OLD.id);
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_refund_escrow_on_job_delete ON jobs;
CREATE TRIGGER trigger_refund_escrow_on_job_delete
BEFORE DELETE ON jobs
FOR EACH ROW
EXECUTE FUNCTION refund_escrow_on_job_delete();
