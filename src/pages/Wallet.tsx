import { useState, useEffect } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Wallet as WalletIcon, TrendingUp, Lock, History,
  ArrowDownToLine, Plus, ArrowRightLeft, Banknote, CreditCard,
} from 'lucide-react';
import { supabase, Transaction } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useToast } from '../lib/toast';
import { QK } from '../lib/queryKeys';
import { fetchWallet } from '../lib/queries';
import { PromptModal } from '../components/PromptModal';
import BankDetailsModal from '../components/BankDetailsModal';

export default function Wallet() {
  const { currentUser, setWallet, viewMode } = useStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [withdrawProcessing, setWithdrawProcessing] = useState(false);
  const [clientWithdrawing,  setClientWithdrawing]  = useState(false);
  const [clientProcessing,   setClientProcessing]   = useState(false);
  const [funding,            setFunding]            = useState(false);
  const [verifying,          setVerifying]          = useState(false);
  const [transferring,       setTransferring]       = useState(false);
  const [showBankModal,      setShowBankModal]      = useState(false);

  // Prompt state
  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    defaultValue: string;
    onConfirm: (val: string) => void;
  } | null>(null);

  const isClient = viewMode === 'buying';

  // ── Live wallet via React Query ──────────────────────────────────────────
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: QK.wallet(currentUser?.id ?? ''),
    queryFn:  () => fetchWallet(currentUser!.id),
    enabled:  !!currentUser,
  });

  // Keep Zustand store in sync whenever React Query refetches the wallet
  useEffect(() => {
    if (wallet) setWallet(wallet);
  }, [wallet]);

  // ── Live transactions via React Query ────────────────────────────────────
  const typeFilter = isClient
    ? ['deposit', 'escrow_lock', 'transfer_to_client', 'client_withdrawal']
    : ['escrow_release', 'withdrawal', 'transfer_to_client'];

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: [...QK.wallet(currentUser?.id ?? ''), 'transactions', viewMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', currentUser!.id)
        .in('type', typeFilter)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentUser,
  });

  const loading = walletLoading || txLoading;

  // Helper: invalidate wallet + tx cache after any mutation
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.wallet(currentUser!.id) });
    qc.invalidateQueries({ queryKey: QK.earnings(currentUser!.id) });
  };

  // ─── Fund Client Account ────────────────────────────────────────────────
  const handleFundAccount = () => {
    setPromptState({
      isOpen: true,
      title: 'Fund Client Wallet',
      message: 'Enter amount to fund (₦):',
      defaultValue: '5000',
      onConfirm: async (amountStr) => {
        setPromptState(null);
        const fundAmount = parseFloat(amountStr);
        if (isNaN(fundAmount) || fundAmount <= 0) { 
          toast.warning('Please enter a valid amount.'); 
          return; 
        }

        setFunding(true);
        try {
          // Initialize Paystack transaction
          const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
          if (!paystackPublicKey) {
            throw new Error('Paystack configuration missing');
          }

          // Initialize Paystack Checkout with user metadata
          const handler = (window as any).PaystackPop.setup({
            key: paystackPublicKey,
            email: currentUser?.email,
            amount: fundAmount * 100, // Paystack uses kobo (1/100 of Naira)
            ref: `fund_${currentUser?.id}_${Date.now()}`,
            metadata: {
              user_id: currentUser?.id,
              amount: fundAmount,
              type: 'wallet_funding'
            },
            onClose: () => {
              toast.info('Payment cancelled');
              setFunding(false);
            },
            onSuccess: async (response: any) => {
              setFunding(false);
              setVerifying(true);
              try {
                // Call our Edge Function to verify the payment server-side and credit the wallet
                const { data, error } = await supabase.functions.invoke('verify-payment', {
                  body: { reference: response.reference }
                });

                if (error) throw error;

                if (data?.status === 'already_processed') {
                  toast.info('Payment already credited to your wallet.');
                } else {
                  toast.success(`₦${fundAmount.toLocaleString()} has been added to your wallet!`, 'Payment Successful!');
                }

                invalidate();
              } catch (err: any) {
                console.error('Payment verification error:', err);
                toast.error(err.message || 'Payment received but verification failed. Please contact support with your reference: ' + response.reference);
              } finally {
                setVerifying(false);
              }
            },
          });
          handler.openIframe();
        } catch (err: any) {
          console.error(err);
          toast.error(err.message || 'Failed to initialize payment. Please try again.');
          setFunding(false);
        }
      }
    });
  };

  // ─── Client Withdrawal ──────────────────────────────────────────────────
  const handleClientWithdraw = async () => {
    // Check if user has bank details saved (same table used by freelancer flow)
    const { data: bankAccount } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', currentUser?.id)
      .maybeSingle();

    if (!bankAccount) {
      toast.warning('Please add your bank details first', 'Bank Details Required');
      setShowBankModal(true);
      return;
    }

    const { data: liveWallet } = await supabase.from('wallets').select('available_balance').eq('user_id', currentUser?.id).single();
    const availBal = liveWallet?.available_balance ?? 0;
    if (!liveWallet || availBal <= 0) { toast.warning('You have no available balance to withdraw.'); return; }

    setPromptState({
      isOpen: true,
      title: 'Withdraw to Bank',
      message: `Enter amount to withdraw (₦):\n\nAvailable: ₦${availBal.toLocaleString()}\nBank: ${bankAccount.account_name} (****${bankAccount.account_number.slice(-4)})`,
      defaultValue: availBal.toString(),
      onConfirm: async (amountStr) => {
        setPromptState(null);
        const withdrawAmount = parseFloat(amountStr);
        if (isNaN(withdrawAmount) || withdrawAmount <= 0) { toast.warning('Please enter a valid amount.'); return; }
        if (withdrawAmount > availBal) { toast.error(`Insufficient balance. You only have ₦${availBal.toLocaleString()} available.`); return; }

        setClientProcessing(true);
        try {
          // Call Edge Function to initiate Paystack Transfer — uses saved bank_accounts record
          const { error } = await supabase.functions.invoke('paystack-transfer', {
            body: { amount: withdrawAmount, source: 'client_wallet' }
          });
          if (error) throw error;

          invalidate();
          toast.success(`₦${withdrawAmount.toLocaleString()} has been deducted from your wallet. Your bank account will be credited shortly.`, 'Withdrawal Successful!');
        } catch (err: any) {
          console.error(err);
          toast.error(err.message || 'Withdrawal failed. Please try again.');
        } finally {
          setClientProcessing(false);
        }
      }
    });
  };

  // ─── Freelancer Withdraw Earnings ───────────────────────────────────────
  const handleWithdraw = async () => {
    const { data: liveWallet } = await supabase.from('wallets').select('*').eq('user_id', currentUser?.id).single();
    const freeBal = liveWallet?.freelancer_balance ?? 0;
    if (!liveWallet || freeBal <= 0) { toast.warning('You have no earnings available for withdrawal.'); return; }

    setPromptState({
      isOpen: true,
      title: 'Withdraw Earnings',
      message: `Enter amount to withdraw (₦):\n\nAvailable balance: ₦${freeBal.toLocaleString()}`,
      defaultValue: freeBal.toString(),
      onConfirm: async (amountStr) => {
        setPromptState(null);
        const withdrawAmount = parseFloat(amountStr);
        if (isNaN(withdrawAmount) || withdrawAmount <= 0) { toast.warning('Please enter a valid amount.'); return; }
        if (withdrawAmount > freeBal) { toast.error(`Insufficient balance. You only have ₦${freeBal.toLocaleString()} available.`); return; }

        setWithdrawProcessing(true);
        try {
          // Call Edge Function to initiate Paystack Transfer
          const { error } = await supabase.functions.invoke('paystack-transfer', {
            body: { amount: withdrawAmount }
          });
          if (error) throw error;

          invalidate();
          toast.success(`₦${withdrawAmount.toLocaleString()} has been deducted from your earnings. Your bank account will be credited shortly.`, 'Withdrawal Successful!');
        } catch (err: any) {
          console.error(err);
          toast.error(err.message || 'Withdrawal failed. Please try again.');
        } finally {
          setWithdrawProcessing(false);
        }
      }
    });
  };

  // ─── Transfer Freelancer Earnings → Client Wallet ───────────────────────
  const handleTransferToClient = async () => {
    const { data: liveWallet } = await supabase.from('wallets').select('*').eq('user_id', currentUser?.id).single();
    const freeBal = liveWallet?.freelancer_balance ?? 0;
    if (!liveWallet || freeBal <= 0) { toast.warning('You have no freelancer earnings to transfer.'); return; }

    setPromptState({
      isOpen: true,
      title: 'Transfer to Client Wallet',
      message: `Enter amount to transfer to Client Wallet (₦):\n\nAvailable balance: ₦${freeBal.toLocaleString()}`,
      defaultValue: freeBal.toString(),
      onConfirm: async (amountStr) => {
        setPromptState(null);
        const transferAmount = parseFloat(amountStr);
        if (isNaN(transferAmount) || transferAmount <= 0) { toast.warning('Please enter a valid amount.'); return; }
        if (transferAmount > freeBal) { toast.error(`Insufficient balance. You only have ₦${freeBal.toLocaleString()} available.`); return; }

        setTransferring(true);
        try {
          // Use secure Postgres RPC
          const { error } = await supabase.rpc('rpc_transfer_to_client', {
            p_amount: transferAmount
          });
          if (error) throw error;

          invalidate();
          toast.success(`₦${transferAmount.toLocaleString()} transferred successfully.`, 'Transfer Complete!');
        } catch (err: any) {
          console.error(err);
          toast.error(err.message || 'Transfer failed. Please try again.');
        } finally {
          setTransferring(false);
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-gray-600">Loading wallet...</p>
        </div>
      </div>
    );
  }

  const bgGradient = isClient ? 'from-blue-950 to-blue-800' : 'from-green-600 to-green-500';
  const textClass  = isClient ? 'text-blue-950' : 'text-green-600';

  const availableBalance  = wallet?.available_balance  ?? 0;
  const freelancerBalance = wallet?.freelancer_balance ?? 0;
  const escrowBalance     = wallet?.escrow_balance     ?? 0;
  const primaryBalance    = isClient ? availableBalance + escrowBalance : freelancerBalance;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className={`text-3xl font-bold ${textClass}`}>
            {isClient ? 'Client Wallet' : 'Freelancer Wallet'}
          </h1>
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            {isClient ? (
              <>
                <button id="btn-fund-account" onClick={handleFundAccount} disabled={funding}
                  className="flex flex-1 sm:flex-none justify-center items-center gap-2 bg-blue-950 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-900 transition-all shadow-sm disabled:opacity-50 text-sm">
                  <Plus className="w-4 h-4" />
                  {funding ? 'Processing...' : 'Fund Account'}
                </button>
                <button id="btn-bank-details" onClick={() => setShowBankModal(true)}
                  className="flex flex-1 sm:flex-none justify-center items-center gap-2 bg-gray-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-700 transition-all shadow-sm text-sm">
                  <CreditCard className="w-4 h-4" />
                  Bank Details
                </button>
                <button id="btn-client-withdraw" onClick={handleClientWithdraw} disabled={clientWithdrawing}
                  className="flex flex-1 sm:flex-none justify-center items-center gap-2 bg-white text-blue-950 border-2 border-blue-950 px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-50 transition-all shadow-sm disabled:opacity-50 text-sm">
                  <ArrowDownToLine className="w-4 h-4" />
                  {clientWithdrawing ? 'Processing...' : 'Withdraw'}
                </button>
              </>
            ) : (
              <>
                <button id="btn-transfer-to-client" onClick={handleTransferToClient} disabled={transferring}
                  className="flex flex-1 sm:flex-none justify-center items-center gap-2 bg-blue-100 text-blue-700 px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-200 transition-all shadow-sm disabled:opacity-50 text-sm">
                  <ArrowRightLeft className="w-4 h-4" />
                  {transferring ? 'Transferring...' : 'Transfer to Client Wallet'}
                </button>
                <button id="btn-withdraw-earnings" onClick={handleWithdraw} disabled={withdrawProcessing}
                  className="flex flex-1 sm:flex-none justify-center items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-green-700 transition-all shadow-sm disabled:opacity-50 text-sm">
                  <Banknote className="w-4 h-4" />
                  {withdrawProcessing ? 'Processing...' : 'Withdraw Earnings'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Balance Cards ── */}
        <div className={`grid grid-cols-1 ${isClient ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4 lg:gap-6 mb-8`}>
          <div className={`bg-gradient-to-br ${bgGradient} rounded-xl shadow-lg p-6 text-white`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <WalletIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{isClient ? 'Total Client Balance' : 'Available Earnings'}</h2>
                <p className="text-xs text-white/80">{isClient ? 'Available + In Escrow' : 'Ready for withdrawal or transfer'}</p>
              </div>
            </div>
            <p className="text-3xl font-bold">₦{primaryBalance.toLocaleString()}</p>
          </div>

          {isClient && (
            <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-blue-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Available to Hire</h2>
                  <p className="text-xs text-gray-500">Funded · Ready to spend</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-blue-600">₦{availableBalance.toLocaleString()}</p>
            </div>
          )}

          {isClient && (
            <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <Lock className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">In Escrow</h2>
                  <p className="text-xs text-gray-500">Locked in active jobs</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-600">₦{escrowBalance.toLocaleString()}</p>
            </div>
          )}

          {!isClient && (
            <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <Lock className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Pending Release</h2>
                  <p className="text-xs text-gray-500">Funds held in escrow by clients</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-600">₦{escrowBalance.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* ── Transaction History ── */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <History className={`w-6 h-6 ${textClass}`} />
            <div>
              <h2 className={`text-xl font-bold ${textClass}`}>
                {isClient ? 'Client Transactions' : 'Freelancer Earnings History'}
              </h2>
              <p className="text-xs text-gray-400">
                {isClient
                  ? 'Deposits, withdrawals, escrow locks, and internal transfers'
                  : 'Escrow releases, withdrawals, and internal transfers'}
              </p>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500"><p>No transactions yet</p></div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => {
                let amountPrefix = '';
                let colorClass = 'text-gray-600';
                if (isClient) {
                  if (transaction.type === 'deposit' || transaction.type === 'transfer_to_client') { amountPrefix = '+'; colorClass = 'text-green-600'; }
                  else if (transaction.type === 'escrow_lock' || transaction.type === 'client_withdrawal') { amountPrefix = '-'; colorClass = 'text-red-600'; }
                } else {
                  if (transaction.type === 'escrow_release') { amountPrefix = '+'; colorClass = 'text-green-600'; }
                  else if (transaction.type === 'withdrawal' || transaction.type === 'transfer_to_client') { amountPrefix = '-'; colorClass = 'text-red-600'; }
                }
                return (
                  <div key={transaction.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{transaction.description}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-gray-500">
                          {new Date(transaction.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                          {transaction.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <div className={`text-lg font-bold ${colorClass}`}>
                      {amountPrefix}₦{transaction.amount.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {verifying && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center gap-4 max-w-xs w-full mx-4">
            <div className="w-12 h-12 border-4 border-blue-950 border-t-transparent rounded-full animate-spin" />
            <p className="text-lg font-semibold text-gray-900">Verifying Payment</p>
            <p className="text-sm text-gray-500 text-center">Please wait while we confirm your payment with Paystack...</p>
          </div>
        </div>
      )}
      {clientProcessing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center gap-4 max-w-xs w-full mx-4">
            <div className="w-12 h-12 border-4 border-blue-950 border-t-transparent rounded-full animate-spin" />
            <p className="text-lg font-semibold text-gray-900">Processing Withdrawal</p>
            <p className="text-sm text-gray-500 text-center">Please wait while we process your withdrawal request...</p>
          </div>
        </div>
      )}
      {withdrawProcessing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center gap-4 max-w-xs w-full mx-4">
            <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-lg font-semibold text-gray-900">Processing Withdrawal</p>
            <p className="text-sm text-gray-500 text-center">Please wait while we process your earnings withdrawal...</p>
          </div>
        </div>
      )}
      {promptState && (
        <PromptModal
          isOpen={promptState.isOpen}
          title={promptState.title}
          message={promptState.message}
          defaultValue={promptState.defaultValue}
          onConfirm={promptState.onConfirm}
          onCancel={() => setPromptState(null)}
        />
      )}
      <BankDetailsModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        onSuccess={() => {
          invalidate();
          setShowBankModal(false);
        }}
      />
    </div>
  );
}
