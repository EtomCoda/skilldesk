-- Migration: Split wallet balances

-- Add freelancer_balance to wallets table if it doesn't exist
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS freelancer_balance numeric DEFAULT 0 NOT NULL;
