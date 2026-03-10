import { useState, useEffect } from 'react';
import { Wallet as WalletIcon, TrendingUp, Lock, History, ArrowDownToLine, Plus } from 'lucide-react';
import { supabase, Transaction } from '../lib/supabase';
import { useStore } from '../store/useStore';

export default function Wallet() {
  const { currentUser, wallet, setWallet, viewMode } = useStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [funding, setFunding] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchWalletData();
    }
  }, [currentUser]);

  const fetchWalletData = async () => {
    try {
      const { data: walletData } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', currentUser?.id)
        .maybeSingle();

      if (walletData) {
        setWallet(walletData);
      } else if (currentUser) {
        const { data: newWallet } = await supabase
          .from('wallets')
          .insert({
            user_id: currentUser.id,
            available_balance: 0,
            escrow_balance: 0,
          })
          .select()
          .single();

        setWallet(newWallet);
      }

      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', currentUser?.id)
        .in('type', ['deposit', 'escrow_lock', 'withdrawal'])
        .order('created_at', { ascending: false });

      if (transactionsData) {
        setTransactions(transactionsData);
      }
    } catch (err) {
      console.error('Error fetching wallet data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFundAccount = async () => {
    const amount = prompt('Enter amount to fund (₦):', '5000');
    if (!amount) return;

    const fundAmount = parseFloat(amount);
    if (isNaN(fundAmount) || fundAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    setFunding(true);
    try {
      const { data: currentWallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', currentUser?.id)
        .single();

      if (!currentWallet) throw new Error('Wallet not found');

      const { error: updateError } = await supabase
        .from('wallets')
        .update({
          available_balance: currentWallet.available_balance + fundAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', currentUser?.id);

      if (updateError) throw updateError;

      await supabase.from('transactions').insert({
        user_id: currentUser?.id,
        amount: fundAmount,
        type: 'deposit',
        description: `Account funded via simulation`,
      });

      setWallet({ ...currentWallet, available_balance: currentWallet.available_balance + fundAmount });
      fetchWalletData();
      alert(`Successfully funded account with ₦${fundAmount.toLocaleString()}!`);
    } catch (err) {
      console.error('Error funding account:', err);
      alert('Funding failed.');
    } finally {
      setFunding(false);
    }
  };

  const handleWithdraw = async () => {
    if (!wallet || wallet.available_balance <= 0) {
      alert('You have no funds available for withdrawal.');
      return;
    }

    const amount = prompt('Enter amount to withdraw (₦):', wallet.available_balance.toString());
    if (!amount) return;

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    if (withdrawAmount > wallet.available_balance) {
      alert('Insufficient available balance.');
      return;
    }

    setWithdrawing(true);
    try {
      const newBalance = wallet.available_balance - withdrawAmount;
      
      const { error: updateError } = await supabase
        .from('wallets')
        .update({
          available_balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', currentUser?.id);

      if (updateError) throw updateError;

      await supabase.from('transactions').insert({
        user_id: currentUser?.id,
        amount: withdrawAmount,
        type: 'withdrawal',
        description: `Withdrawal to bank account`,
      });

      // Update local and global state
      setWallet({ ...wallet, available_balance: newBalance });
      fetchWalletData(); // Refresh transactions
      alert(`Withdrawal of ₦${withdrawAmount.toLocaleString()} successful!`);
    } catch (err) {
      console.error('Error withdrawing:', err);
      alert('Withdrawal failed. Please try again.');
    } finally {
      setWithdrawing(false);
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

  // Client-specific balance: only what was deposited as a client, minus spending
  const clientDeposited = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
  const clientSpent = transactions.filter(t => t.type === 'escrow_lock').reduce((s, t) => s + t.amount, 0);
  // available_balance may include freelance earnings — use wallet value as it's what can actually be spent
  const totalBalance = (wallet?.available_balance || 0) + (wallet?.escrow_balance || 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-blue-950">My Wallet</h1>
          <div className="flex gap-4">
            {viewMode === 'buying' && (
              <button
                onClick={handleFundAccount}
                disabled={funding}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5" />
                {funding ? 'Processing...' : 'Fund Account'}
              </button>
            )}
            <button
              onClick={handleWithdraw}
              disabled={withdrawing || (wallet?.available_balance || 0) <= 0}
              className="flex items-center gap-2 bg-blue-950 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-900 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowDownToLine className="w-5 h-5" />
              {withdrawing ? 'Processing...' : 'Withdraw Funds'}
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-950 to-blue-800 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <WalletIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Total Balance</h2>
                <p className="text-xs text-blue-200">Available + In Escrow</p>
              </div>
            </div>
            <p className="text-3xl font-bold">₦{totalBalance.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-green-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Available to Hire</h2>
                <p className="text-xs text-gray-500">Funded · Ready to spend</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-green-600">
              ₦{(wallet?.available_balance || 0).toLocaleString()}
            </p>
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 space-y-0.5">
              <p>Deposited: <span className="font-semibold text-gray-600">₦{clientDeposited.toLocaleString()}</span></p>
              <p>Spent on hires: <span className="font-semibold text-gray-600">₦{clientSpent.toLocaleString()}</span></p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-blue-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">In Escrow</h2>
                <p className="text-xs text-gray-500">Locked in active jobs</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-blue-600">
              ₦{(wallet?.escrow_balance || 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <History className="w-6 h-6 text-blue-950" />
            <div>
              <h2 className="text-xl font-bold text-blue-950">Transaction History</h2>
              <p className="text-xs text-gray-400">Deposits, hires &amp; withdrawals · Freelance earnings tracked separately</p>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{transaction.description}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-gray-500">
                        {new Date(transaction.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        transaction.type === 'escrow_release' || transaction.type === 'deposit' ? 'bg-green-100 text-green-700' :
                        transaction.type === 'escrow_lock' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {transaction.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className={`text-lg font-bold ${
                    transaction.type === 'escrow_release' || transaction.type === 'deposit' ? 'text-green-600' :
                    transaction.type === 'withdrawal' ? 'text-red-600' :
                    'text-blue-600'
                  }`}>
                    {transaction.type === 'escrow_release' || transaction.type === 'deposit' ? '+' : transaction.type === 'withdrawal' ? '-' : ''}
                    ₦{transaction.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
