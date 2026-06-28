import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { reference } = await req.json();

    if (!reference) {
      return new Response(
        JSON.stringify({ error: 'Transaction reference is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY not set');
    }

    console.log(`Verifying payment reference: ${reference}`);

    // 1. Verify the transaction with Paystack's API server-side
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      console.error('Paystack verification failed:', paystackData.message);
      return new Response(
        JSON.stringify({ error: paystackData.message || 'Payment verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const txData = paystackData.data;
    const userId = txData.metadata?.user_id;
    const amountNaira = txData.amount / 100; // kobo → naira

    if (!userId) {
      throw new Error('No user_id in payment metadata');
    }

    console.log(`Payment verified: ₦${amountNaira} for user ${userId}`);

    // 2. Initialize Supabase with Service Role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Idempotency check — has this reference already been processed?
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('paystack_reference', reference)
      .maybeSingle();

    if (existing) {
      console.log(`Reference ${reference} already processed — skipping duplicate credit`);
      return new Response(
        JSON.stringify({ status: 'already_processed', message: 'Payment already credited' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 4. Credit the wallet atomically via our secure RPC
    const { error: rpcError } = await supabase.rpc('rpc_credit_wallet', {
      p_user_id: userId,
      p_amount: amountNaira,
      p_reference: reference,
    });

    if (rpcError) {
      console.error('rpc_credit_wallet error:', rpcError);
      throw rpcError;
    }

    console.log(`Wallet credited successfully for user ${userId}`);

    return new Response(
      JSON.stringify({ status: 'success', amount: amountNaira }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('verify-payment error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
