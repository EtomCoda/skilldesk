import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { TrendingUp, Briefcase, CheckCircle, Clock, ArrowDownToLine, ArrowRightLeft, Banknote } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { useToast } from '../../lib/toast';
import { QK } from '../../lib/queryKeys';
import { fetchEarnings } from '../../lib/queries';

interface EarningsTransaction {
  id: string; amount: number; description: string; created_at: string; job_id?: string;
}

export default function MyEarnings() {
  const navigate = useNavigate();
  const { currentUser, setWallet } = useStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [withdrawing,  setWithdrawing]  = useState(false);
  const [transferring, setTransferring] = useState(false);

  // ── React Query: earnings + wallet in one cached call ───────────────────
  const { data, isLoading } = useQuery({
    queryKey: QK.earnings(currentUser?.id ?? ''),
    queryFn:  () => fetchEarnings(currentUser!.id),
    enabled:  !!currentUser,
  });

  // Keep Zustand store in sync whenever React Query refetches
  useEffect(() => {
    if (data?.wallet) setWallet(data.wallet);
  }, [data?.wallet]);

  const hires        = data?.hires        ?? [];
  const earningsTxns = data?.transactions ?? [];
  const liveWallet   = data?.wallet;
  const liveBalance  = liveWallet?.freelancer_balance ?? 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.earnings(currentUser!.id) });
    qc.invalidateQueries({ queryKey: QK.wallet(currentUser!.id) });
  };

  // ─── Withdraw Earnings ──────────────────────────────────────────────────
  const handleWithdraw = async () => {
    // Re-fetch live balance before acting (safety net even though RQ is fresh)
    const { data: live } = await supabase.from('wallets').select('*').eq('user_id', currentUser?.id).single();
    const freeBal = live?.freelancer_balance ?? 0;
    if (freeBal <= 0) { toast.warning('You have no earnings available for withdrawal. Complete a job to earn funds.'); return; }

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

  // ─── Transfer Earnings → Client Wallet ─────────────────────────────────
  const handleTransferToClient = async () => {
    const { data: live } = await supabase.from('wallets').select('*').eq('user_id', currentUser?.id).single();
    const freeBal = live?.freelancer_balance ?? 0;
    if (freeBal <= 0) { toast.warning('You have no earnings available to transfer. Complete a job to earn funds.'); return; }

    const amount = prompt(`Enter amount to transfer to Client Wallet (₦):\n\nAvailable balance: ₦${freeBal.toLocaleString()}`, freeBal.toString());
    if (!amount) return;
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) { toast.warning('Please enter a valid amount.'); return; }
    if (transferAmount > freeBal) { toast.error(`Insufficient balance. You only have ₦${freeBal.toLocaleString()} available.`); return; }

    setTransferring(true);
    try {
      const { error } = await supabase.from('wallets').update({
        freelancer_balance: freeBal - transferAmount,
        available_balance:  (live?.available_balance ?? 0) + transferAmount,
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const activeJobs    = hires.filter((h) => h.status === 'funded');
  const completedJobs = hires.filter((h) => h.status === 'completed');
  const pendingPayment = activeJobs.reduce((sum, h) => sum + h.escrow_amount, 0);
  const totalEarnings  = completedJobs.reduce((sum, h) => sum + h.escrow_amount, 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Header with action buttons ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold text-green-600">My Earnings</h1>
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
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
          </div>
        </div>

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-8">
          {/* Available to Withdraw — live from RQ cache */}
          <div className="lg:col-span-2 bg-gradient-to-br from-green-600 to-green-500 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <Banknote className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Available to Withdraw</h2>
                <p className="text-xs text-green-100">Live balance · Ready to withdraw or transfer</p>
              </div>
            </div>
            <p className="text-3xl font-bold">
              {isLoading
                ? <span className="text-lg opacity-70">Checking...</span>
                : `₦${liveBalance.toLocaleString()}`}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-green-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Total Earned</h2>
                <p className="text-xs text-gray-500">Completed jobs only</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-green-600">₦{totalEarnings.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-yellow-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Pending Payment</h2>
                <p className="text-xs text-gray-500">On active jobs</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-yellow-600">₦{pendingPayment.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-blue-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Active Jobs</h2>
            </div>
            <p className="text-3xl font-bold text-blue-600">{activeJobs.length}</p>
          </div>
        </div>

        {/* ── Transaction History ── */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <ArrowDownToLine className="w-6 h-6 text-green-600" />
            <div>
              <h2 className="text-xl font-bold text-green-600">Earnings History</h2>
              <p className="text-xs text-gray-400">Completed job payments</p>
            </div>
          </div>
          {earningsTxns.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p>No earnings yet. Complete a job to see payments here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {earningsTxns.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{tx.description}</p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-lg font-bold text-green-600">+₦{tx.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
