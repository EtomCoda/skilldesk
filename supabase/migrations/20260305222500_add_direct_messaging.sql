/*
  # Add Direct Messaging System

  ## Overview
  Adds a direct messaging system to support client-to-freelancer chats
  initiated via accepted chat_requests. This is separate from job-based
  messages (which require a job_id).

  ## New Tables

  ### 1. direct_conversations
  Represents a 1:1 conversation thread between two users.
  - `id` (uuid, primary key)
  - `participant_a` (uuid, references users) - typically the buyer
  - `participant_b` (uuid, references users) - typically the seller
  - `chat_request_id` (uuid, references chat_requests, nullable)
  - `created_at` (timestamptz)
  - UNIQUE(participant_a, participant_b) - one conversation per pair

  ### 2. direct_messages
  Messages within a direct conversation.
  - `id` (uuid, primary key)
  - `conversation_id` (uuid, references direct_conversations)
  - `sender_id` (uuid, references users)
  - `message` (text)
  - `created_at` (timestamptz)
*/

-- Create direct_conversations table
CREATE TABLE IF NOT EXISTS direct_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  participant_b uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  chat_request_id uuid REFERENCES chat_requests(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(participant_a, participant_b)
);

-- Create direct_messages table
CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES direct_conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for direct_conversations
CREATE POLICY "Participants can view their conversations"
  ON direct_conversations FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create a direct conversation"
  ON direct_conversations FOR INSERT
  WITH CHECK (true);

-- RLS Policies for direct_messages
CREATE POLICY "Anyone can view direct messages"
  ON direct_messages FOR SELECT
  USING (true);

CREATE POLICY "Participants can send direct messages"
  ON direct_messages FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_direct_conversations_participant_a ON direct_conversations(participant_a);
CREATE INDEX IF NOT EXISTS idx_direct_conversations_participant_b ON direct_conversations(participant_b);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_id ON direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON direct_messages(sender_id);
