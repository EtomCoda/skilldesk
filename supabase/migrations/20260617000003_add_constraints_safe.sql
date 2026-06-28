/*
  # Add Data Constraints (Safe Migration)
  
  This migration cleans up any legacy zero/null values from the prototype
  before applying hard constraints that prevent them going forward.
*/

-- Clean up any prototype test data before applying constraints
UPDATE proposals SET proposed_amount = 1 WHERE proposed_amount <= 0 OR proposed_amount IS NULL;
UPDATE jobs SET budget = 1 WHERE budget <= 0 OR budget IS NULL;
UPDATE wallets SET available_balance = 0 WHERE available_balance < 0;
UPDATE wallets SET escrow_balance = 0 WHERE escrow_balance < 0;
UPDATE wallets SET freelancer_balance = 0 WHERE freelancer_balance < 0;
DELETE FROM transactions WHERE amount = 0;

-- Drop constraints first in case of partial previous runs, then re-add cleanly
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_amount;
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS chk_available_balance;
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS chk_escrow_balance;
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS chk_freelancer_balance;
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS chk_proposed_amount;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS chk_budget;

ALTER TABLE transactions ADD CONSTRAINT chk_transactions_amount CHECK (amount != 0);
ALTER TABLE wallets ADD CONSTRAINT chk_available_balance CHECK (available_balance >= 0);
ALTER TABLE wallets ADD CONSTRAINT chk_escrow_balance CHECK (escrow_balance >= 0);
ALTER TABLE wallets ADD CONSTRAINT chk_freelancer_balance CHECK (freelancer_balance >= 0);
ALTER TABLE proposals ADD CONSTRAINT chk_proposed_amount CHECK (proposed_amount > 0);
ALTER TABLE jobs ADD CONSTRAINT chk_budget CHECK (budget > 0);
