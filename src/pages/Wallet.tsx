import { useState, useEffect } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Wallet as WalletIcon, TrendingUp, Lock, History,
  ArrowDownToLine, Plus, ArrowRightLeft, Banknote,
} from 'lucide-react';
import { supabase, Transaction } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useToast } from '../lib/toast';
import { QK } from '../lib/queryKeys';
import { fetchWallet } from '../lib/queries';

export default function Wallet() {
  const { currentUser, setWallet, viewMode } = useStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [withdrawing,      setWithdrawing]      = useState(false);
  const [clientWithdrawing,setClientWithdrawing] = useState(false);
  const [funding,          setFunding]          = useState(false);
  const [transferring,     setTransferring]     = useState(false);

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
  const handleFundAccount = async () => {
    const amount = prompt('Enter amount to fund (₦):', '5000');
    if (!amount) return;
    const fundAmount = parseFloat(amount);
    if (isNaN(fundAmount) || fundAmount <= 0) { toast.warning('Please enter a valid amount.'); return; }

    setFunding(true);
    try {
      const { data: liveWallet } = await supabase.from('wallets').select('*').eq('user_id', currentUser?.id).single();
      if (!liveWallet) throw new Error('Wallet not found');

      const { error } = await supabase.from('wallets').update({
        available_balance: liveWallet.available_balance + fundAmount,
        updated_at: new Date().toISOString(),
      }).eq('user_id', currentUser?.id);
      if (error) throw error;

      await supabase.from('transactions').insert({
        user_id: currentUser?.id, amount: fundAmount, type: 'deposit',
        description: 'Account funded via simulation',
      });

      invalidate();
      toast.success(`₦${fundAmount.toLocaleString()} has been added to your client wallet.`, 'Account Funded!');
    } catch (err) {
      console.error(err);
      toast.error('Funding failed. Please try again.');
    } finally {
      setFunding(false);
    }
  };

  // ─── Client Withdrawal ──────────────────────────────────────────────────
  const handleClientWithdraw = async () => {
    const { data: liveWallet } = await supabase.from('wallets').select('*').eq('user_id', currentUser?.id).single();
    const availBal = liveWallet?.available_balance ?? 0;
    if (!liveWallet || availBal <= 0) { toast.warning('You have no available balance to withdraw.'); return; }

    const amount = prompt(`Enter amount to withdraw (₦):\n\nAvailable: ₦${availBal.toLocaleString()}`, availBal.toString());
    if (!amount) return;
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) { toast.warning('Please enter a valid amount.'); return; }
    if (withdrawAmount > availBal) { toast.error(`Insufficient balance. You only have ₦${availBal.toLocaleString()} available.`); return; }

    setClientWithdrawing(true);
    try {
      const { error } = await supabase.from('wallets').update({
        available_balance: availBal - withdrawAmount,
        updated_at: new Date().toISOString(),
      }).eq('user_id', currentUser?.id);
      if (error) throw error;

      await supabase.from('transactions').insert({
        user_id: currentUser?.id, amount: withdrawAmount, type: 'client_withdrawal',
        description: 'Client wallet withdrawal to bank account',
      });

      invalidate();
      toast.success(`₦${withdrawAmount.toLocaleString()} withdrawal is being processed.`, 'Withdrawal Initiated!');
    } catch (err) {
      console.error(err);
      toast.error('Withdrawal failed. Please try again.');
    } finally {
      setClientWithdrawing(false);
    }
  };

  // ─── Freelancer Withdraw Earnings ───────────────────────────────────────
  const handleWithdraw = async () => {
    const { data: liveWallet } = await supabase.from('wallets').select('*').eq('user_id', currentUser?.id).single();
    const freeBal = liveWallet?.freelancer_balance ?? 0;
    if (!liveWallet || freeBal <= 0) { toast.warning('You have no earnings available for withdrawal.'); return; }

    const amount = prompt(`Enter amount to withdraw (₦):\n\nAvailable balance: ₦${freeBal.toLocaleString()}`, freeBal.toString());
    if (!amount) return;
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) { toast.warning('Please enter a valid amount.'); return; }
    if (withdrawAmount > freeBal) { toast.error(`Insufficient balance. You only have ₦${freeBal.toLocaleString()} available.`); return; }

    setWithdrawing(true);
    try {
      const { error } = await supabase.from('wallets').update({
        freelancer_balance: freeBal - withdrawAmount,
        updated_at: new Date().toISOString(),
      }).eq('user_id', currentUser?.id);
      if (error) throw error;

      await supabase.from('transactions').insert({
        user_id: currentUser?.id, amount: withdrawAmount, type: 'withdrawal',
        description: 'Withdrawal to bank account',
      });

      invalidate();
      toast.success(`₦${withdrawAmount.toLocaleString()} withdrawal is being processed.`, 'Withdrawal Successful!');
    } catch (err) {
      console.error(err);
      toast.error('Withdrawal failed. Please try again.');
    } finally {
      setWithdrawing(false);
    }
  };

  // ─── Transfer Freelancer Earnings → Client Wallet ───────────────────────
  const handleTransferToClient = async () => {
    const { data: liveWallet } = await supabase.from('wallets').select('*').eq('user_id', currentUser?.id).single();
    const freeBal = liveWallet?.freelancer_balance ?? 0;
    if (!liveWallet || freeBal <= 0) { toast.warning('You have no freelancer earnings to transfer.'); return; }

    const amount = prompt(`Enter amount to transfer to Client Wallet (₦):\n\nAvailable balance: ₦${freeBal.toLocaleString()}`, freeBal.toString());
    if (!amount) return;
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) { toast.warning('Please enter a valid amount.'); return; }
    if (transferAmount > freeBal) { toast.error(`Insufficient balance. You only have ₦${freeBal.toLocaleString()} available.`); return; }

    setTransferring(true);
    try {
      const { error } = await supabase.from('wallets').update({
        freelancer_balance: freeBal - transferAmount,
        available_balance: (liveWallet.available_balance ?? 0) + transferAmount,
        updated_at: new Date().toISOString(),
      }).eq('user_id', currentUser?.id);
      if (error) throw error;

      await supabase.from('transactions').insert({
        user_id: currentUser?.id, amount: transferAmount, type: 'transfer_to_client',
        description: 'Transfer from Freelancer earnings to Client wallet',
      });

      invalidate();
      toast.success(`₦${transferAmount.toLocaleString()} transferred successfully.`, 'Transfer Complete!');
    } catch (err) {
      console.error(err);
      toast.error('Transfer failed. Please try again.');
    } finally {
      setTransferring(false);
    }
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
                <button id="btn-withdraw-earnings" onClick={handleWithdraw} disabled={withdrawing}
                  className="flex flex-1 sm:flex-none justify-center items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-green-700 transition-all shadow-sm disabled:opacity-50 text-sm">
                  <Banknote className="w-4 h-4" />
                  {withdrawing ? 'Processing...' : 'Withdraw Earnings'}
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
    </div>
  );
}
