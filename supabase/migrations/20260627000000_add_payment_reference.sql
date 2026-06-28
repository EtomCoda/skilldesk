-- Add paystack_reference column to transactions for idempotency
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paystack_reference text UNIQUE;

-- Update rpc_credit_wallet to accept and store the reference
CREATE OR REPLACE FUNCTION rpc_credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_reference text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero.';
  END IF;

  -- Credit the wallet
  UPDATE wallets
  SET available_balance = available_balance + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Log the transaction with the Paystack reference for idempotency
  INSERT INTO transactions (user_id, amount, type, description, paystack_reference)
  VALUES (p_user_id, p_amount, 'deposit', 'Wallet funded via Paystack', p_reference);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update the webhook to use the same idempotency-aware function
-- (webhook now calls rpc_credit_wallet with p_reference too, handled server-side)
