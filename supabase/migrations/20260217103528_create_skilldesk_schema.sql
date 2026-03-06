/*
  # Create SkillDesk Database Schema

  ## Overview
  This migration creates the complete database schema for SkillDesk, a freelance marketplace
  for Pan-Atlantic University students where every user can be both a client and a freelancer.

  ## New Tables

  ### 1. users
  Stores user profiles for all registered students
  - `id` (uuid, primary key)
  - `email` (text, unique) - Must end with @pau.edu.ng
  - `full_name` (text) - Student's full name
  - `avatar_url` (text, nullable) - Profile picture URL
  - `bio` (text, nullable) - User bio/description
  - `skills` (text, nullable) - Comma-separated skills
  - `created_at` (timestamptz) - Account creation timestamp

  ### 2. wallets
  Manages financial balances for each user
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to users) - Owner of the wallet
  - `available_balance` (numeric) - Funds available for withdrawal
  - `escrow_balance` (numeric) - Funds locked in escrow
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. jobs
  Job postings created by clients
  - `id` (uuid, primary key)
  - `client_id` (uuid, foreign key to users) - User who posted the job
  - `title` (text) - Job title
  - `description` (text) - Detailed job description
  - `budget` (numeric) - Job budget in Naira
  - `status` (text) - Job status: 'open', 'in_progress', 'completed', 'cancelled'
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. proposals
  Freelancer applications to jobs
  - `id` (uuid, primary key)
  - `job_id` (uuid, foreign key to jobs) - Job being applied to
  - `freelancer_id` (uuid, foreign key to users) - Applicant
  - `cover_letter` (text) - Application message
  - `proposed_amount` (numeric) - Freelancer's proposed price
  - `status` (text) - Proposal status: 'pending', 'accepted', 'rejected'
  - `created_at` (timestamptz)

  ### 5. hires
  Tracks hired freelancers and escrow
  - `id` (uuid, primary key)
  - `job_id` (uuid, foreign key to jobs) - Associated job
  - `freelancer_id` (uuid, foreign key to users) - Hired freelancer
  - `escrow_amount` (numeric) - Amount locked in escrow
  - `status` (text) - Hire status: 'funded', 'completed', 'disputed'
  - `created_at` (timestamptz)
  - `completed_at` (timestamptz, nullable) - Completion timestamp

  ### 6. messages
  Chat messages between clients and freelancers
  - `id` (uuid, primary key)
  - `job_id` (uuid, foreign key to jobs) - Related job
  - `sender_id` (uuid, foreign key to users) - Message sender
  - `receiver_id` (uuid, foreign key to users) - Message recipient
  - `message` (text) - Message content
  - `created_at` (timestamptz)

  ### 7. transactions
  Financial transaction history
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to users) - User involved in transaction
  - `amount` (numeric) - Transaction amount
  - `type` (text) - Transaction type: 'escrow_lock', 'escrow_release', 'withdrawal'
  - `job_id` (uuid, foreign key to jobs, nullable) - Related job
  - `description` (text) - Transaction description
  - `created_at` (timestamptz)

  ## Security
  All tables have Row Level Security (RLS) enabled with appropriate policies.
  - Users can read their own data and data related to their jobs/proposals
  - Users can only modify their own data
  - Messages are visible to both sender and receiver
  - Transactions are read-only for users
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  bio text,
  skills text,
  created_at timestamptz DEFAULT now()
);

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  available_balance numeric DEFAULT 0 NOT NULL,
  escrow_balance numeric DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  budget numeric NOT NULL,
  status text DEFAULT 'open' NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  freelancer_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  cover_letter text NOT NULL,
  proposed_amount numeric NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(job_id, freelancer_id)
);

-- Create hires table
CREATE TABLE IF NOT EXISTS hires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE UNIQUE NOT NULL,
  freelancer_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  escrow_amount numeric NOT NULL,
  status text DEFAULT 'funded' NOT NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hires ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view all profiles"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for wallets table
CREATE POLICY "Users can view own wallet"
  ON wallets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet"
  ON wallets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for jobs table
CREATE POLICY "Anyone can view open jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Job owners can update their jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- RLS Policies for proposals table
CREATE POLICY "Users can view proposals for their jobs or their own proposals"
  ON proposals FOR SELECT
  TO authenticated
  USING (
    auth.uid() = freelancer_id OR
    auth.uid() IN (SELECT client_id FROM jobs WHERE jobs.id = proposals.job_id)
  );

CREATE POLICY "Freelancers can create proposals"
  ON proposals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = freelancer_id);

CREATE POLICY "Job owners can update proposal status"
  ON proposals FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (SELECT client_id FROM jobs WHERE jobs.id = proposals.job_id)
  )
  WITH CHECK (
    auth.uid() IN (SELECT client_id FROM jobs WHERE jobs.id = proposals.job_id)
  );

-- RLS Policies for hires table
CREATE POLICY "Users can view hires related to them"
  ON hires FOR SELECT
  TO authenticated
  USING (
    auth.uid() = freelancer_id OR
    auth.uid() IN (SELECT client_id FROM jobs WHERE jobs.id = hires.job_id)
  );

CREATE POLICY "Job owners can create hires"
  ON hires FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (SELECT client_id FROM jobs WHERE jobs.id = hires.job_id)
  );

CREATE POLICY "Job owners and freelancers can update hires"
  ON hires FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = freelancer_id OR
    auth.uid() IN (SELECT client_id FROM jobs WHERE jobs.id = hires.job_id)
  )
  WITH CHECK (
    auth.uid() = freelancer_id OR
    auth.uid() IN (SELECT client_id FROM jobs WHERE jobs.id = hires.job_id)
  );

-- RLS Policies for messages table
CREATE POLICY "Users can view messages they sent or received"
  ON messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- RLS Policies for transactions table
CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_proposals_job_id ON proposals(job_id);
CREATE INDEX IF NOT EXISTS idx_proposals_freelancer_id ON proposals(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_hires_job_id ON hires(job_id);
CREATE INDEX IF NOT EXISTS idx_hires_freelancer_id ON hires(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_messages_job_id ON messages(job_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);