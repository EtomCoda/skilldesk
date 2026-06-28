/*
  # Client Withdraw RPC

  Adds rpc_client_withdraw: deducts from available_balance and logs a
  client_withdrawal transaction. Callable by the authenticated user only
  (paystack-transfer edge function passes the user's JWT).
*/

CREATE OR REPLACE FUNCTION rpc_client_withdraw(p_amount numeric)
RETURNS void AS $$
DECLARE
  v_available_balance numeric;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount must be greater than zero.';
  END IF;

  SELECT available_balance INTO v_available_balance
  FROM wallets
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found.';
  END IF;

  IF v_available_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. You only have ₦% available.', v_available_balance;
  END IF;

  UPDATE wallets
  SET available_balance = available_balance - p_amount
  WHERE user_id = auth.uid();

  PERFORM log_transaction(
    auth.uid(),
    p_amount,
    'client_withdrawal',
    'Client wallet withdrawal to bank account via Paystack'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
