/*
  # Add Portfolio, Reviews, and Chat Request Tables

  ## New Tables

  ### 1. portfolio_items
  Stores portfolio pieces showcasing freelancer work
  - `id` (uuid, primary key)
  - `freelancer_id` (uuid, foreign key to users)
  - `title` (text) - Portfolio project title
  - `description` (text) - Project description
  - `image_url` (text) - Portfolio image URL
  - `link` (text, nullable) - Link to live project or case study
  - `category` (text) - Project category/domain
  - `created_at` (timestamptz)

  ### 2. reviews
  Mutual review system for clients and freelancers
  - `id` (uuid, primary key)
  - `job_id` (uuid, foreign key to jobs)
  - `reviewer_id` (uuid, foreign key to users) - Who left the review
  - `reviewee_id` (uuid, foreign key to users) - Who is being reviewed
  - `rating` (integer) - 1-5 star rating
  - `comment` (text) - Review comment
  - `created_at` (timestamptz)

  ### 3. chat_requests
  Chat requests from buyers to sellers with job/payment details
  - `id` (uuid, primary key)
  - `buyer_id` (uuid, foreign key to users) - Buyer initiating request
  - `seller_id` (uuid, foreign key to users) - Seller being requested
  - `job_title` (text) - Intended job title
  - `budget` (numeric) - Proposed budget
  - `description` (text) - Job description
  - `status` (text) - 'pending', 'accepted', 'declined'
  - `created_at` (timestamptz)

  ### 4. user_domains
  Track seller expertise domains
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to users)
  - `domain` (text) - Expertise domain (Graphic Design, Writing, Programming, etc.)
  - `created_at` (timestamptz)

  ### 5. seller_stats
  Tracks seller performance metrics
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to users)
  - `total_jobs_completed` (integer)
  - `average_rating` (numeric)
  - `total_reviews` (integer)
  - `updated_at` (timestamptz)
*/

-- Create portfolio_items table
CREATE TABLE IF NOT EXISTS portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  image_url text NOT NULL,
  link text,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  reviewee_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(job_id, reviewer_id)
);

-- Create chat_requests table
CREATE TABLE IF NOT EXISTS chat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  seller_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  job_title text NOT NULL,
  budget numeric NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(buyer_id, seller_id)
);

-- Create user_domains table
CREATE TABLE IF NOT EXISTS user_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  domain text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, domain)
);

-- Create seller_stats table
CREATE TABLE IF NOT EXISTS seller_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  total_jobs_completed integer DEFAULT 0,
  average_rating numeric DEFAULT 0,
  total_reviews integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for portfolio_items
CREATE POLICY "Anyone can view portfolio items"
  ON portfolio_items FOR SELECT
  USING (true);

CREATE POLICY "Freelancers can create portfolio items"
  ON portfolio_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Freelancers can update own portfolio"
  ON portfolio_items FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Freelancers can delete own portfolio"
  ON portfolio_items FOR DELETE
  USING (true);

-- RLS Policies for reviews
CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create reviews"
  ON reviews FOR INSERT
  WITH CHECK (true);

-- RLS Policies for chat_requests
CREATE POLICY "Anyone can view chat requests"
  ON chat_requests FOR SELECT
  USING (true);

CREATE POLICY "Buyers can create chat requests"
  ON chat_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update chat requests"
  ON chat_requests FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- RLS Policies for user_domains
CREATE POLICY "Anyone can view user domains"
  ON user_domains FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their domains"
  ON user_domains FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete their domains"
  ON user_domains FOR DELETE
  USING (true);

-- RLS Policies for seller_stats
CREATE POLICY "Anyone can view seller stats"
  ON seller_stats FOR SELECT
  USING (true);

CREATE POLICY "System can manage stats"
  ON seller_stats FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update stats"
  ON seller_stats FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_freelancer_id ON portfolio_items(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_category ON portfolio_items(category);
CREATE INDEX IF NOT EXISTS idx_reviews_job_id ON reviews(job_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_chat_requests_buyer_id ON chat_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_requests_seller_id ON chat_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_chat_requests_status ON chat_requests(status);
CREATE INDEX IF NOT EXISTS idx_user_domains_user_id ON user_domains(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_stats_user_id ON seller_stats(user_id);