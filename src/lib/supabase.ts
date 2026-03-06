import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  skills?: string;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  available_balance: number;
  escrow_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  client_id: string;
  title: string;
  description: string;
  budget: number;
  min_budget?: number;
  max_budget?: number;
  required_skills?: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: string;
  job_id: string;
  freelancer_id: string;
  cover_letter: string;
  proposed_amount: number;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Hire {
  id: string;
  job_id: string;
  freelancer_id: string;
  escrow_amount: number;
  status: 'funded' | 'completed' | 'disputed';
  created_at: string;
  completed_at?: string;
}

export interface Message {
  id: string;
  job_id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'escrow_lock' | 'escrow_release' | 'withdrawal' | 'deposit';
  job_id?: string;
  description: string;
  created_at: string;
}
