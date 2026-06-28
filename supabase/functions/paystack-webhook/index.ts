import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import crypto from "node:crypto"

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

serve(async (req) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const rawBody = await req.text();
    console.log("Received Webhook Request.");
    
    // Validate Paystack Signature
    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      console.error("Missing x-paystack-signature header");
      return new Response('Unauthorized', { status: 401 });
    }

    if (!PAYSTACK_SECRET_KEY) {
      console.error("PAYSTACK_SECRET_KEY is not set in Edge Function Secrets");
      throw new Error("Server configuration error");
    }

    // Hash the raw body with the secret key using HMAC SHA512
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');

    if (hash !== signature) {
      console.error(`Signature mismatch. Expected ${hash}, got ${signature}`);
      return new Response('Invalid Signature', { status: 401 });
    }

    console.log("Signature validated successfully.");

    const event = JSON.parse(rawBody);
    console.log("Event received:", event.event);

    // We only care about successful charges
    if (event.event === 'charge.success') {
      const data = event.data;
      
      // The user_id should be passed in the metadata when initializing the transaction
      const userId = data.metadata?.user_id || data.metadata?.custom_fields?.find((f: any) => f.variable_name === 'user_id')?.value;
      const amount = data.amount / 100; // Paystack amounts are in kobo, convert to Naira

      console.log(`Processing charge.success for user ${userId} with amount ${amount}`);

      if (!userId) {
        console.error("No user_id found in metadata:", data.metadata);
        throw new Error('No user_id found in metadata');
      }

      // Initialize Supabase Client with Service Role to bypass RLS
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      
      if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing Supabase URL or Service Role Key");
        throw new Error("Missing Supabase configuration");
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      console.log("Calling rpc_credit_wallet...");
      // Call our secure RPC to credit the wallet
      const { error } = await supabase.rpc('rpc_credit_wallet', {
        p_user_id: userId,
        p_amount: amount
      });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }
    }

    return new Response(JSON.stringify({ status: 'success' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Webhook Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
