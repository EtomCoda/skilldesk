import { Link, useLocation } from 'react-router-dom';
import { GraduationCap, Wallet, LogOut, ShoppingBag, Briefcase, Menu, X, MessageCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface NavbarProps {
  onLogout: () => void;
}

export default function Navbar({ onLogout }: NavbarProps) {
  const { wallet, viewMode, toggleViewMode, currentUser } = useStore();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    if (currentUser && viewMode === 'selling') {
      supabase
        .from('chat_requests')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', currentUser.id)
        .eq('status', 'pending')
        .then(({ count }) => setPendingRequestsCount(count || 0));
    } else {
      setPendingRequestsCount(0);
    }
  }, [currentUser, viewMode, location.pathname]);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <nav className="bg-white shadow-lg border-b-4" style={{ borderBottomColor: 'rgb(37, 99, 235)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl" style={{ color: 'rgb(37, 99, 235)' }}>
            <GraduationCap className="w-8 h-8" />
            <span>SkillDesk</span>
          </Link>

          <div className="hidden md:flex items-center gap-4">
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md"
              style={{ borderColor: 'rgb(37, 99, 235)', backgroundColor: 'rgba(37, 99, 235, 0.05)' }}
              onClick={toggleViewMode}
            >
              <button className="flex items-center gap-2">
                {viewMode === 'buying' ? (
                  <>
                    <ShoppingBag className="w-5 h-5" style={{ color: 'rgb(37, 99, 235)' }} />
                    <span className="font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>Client Mode</span>
                  </>
                ) : (
                  <>
                    <Briefcase className="w-5 h-5" style={{ color: 'rgb(37, 99, 235)' }} />
                    <span className="font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>Freelancer Mode</span>
                  </>
                )}
              </button>
            </div>

            <Link
              to="/wallet"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isActive('/wallet') ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
              style={{ color: isActive('/wallet') ? 'rgb(37, 99, 235)' : 'rgb(17, 24, 39)' }}
            >
              <Wallet className="w-5 h-5" />
              <div className="flex flex-col items-start leading-none">
                <span className="text-sm font-medium">Wallet</span>
                {wallet && (
                  <span className="text-[10px] font-bold text-green-600">
                    ₦{wallet.available_balance.toLocaleString()}
                  </span>
                )}
              </div>
            </Link>

            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>

          <button
            className="md:hidden p-2"
            onClick={toggleMobileMenu}
            style={{ color: 'rgb(37, 99, 235)' }}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        <div
          className="border-t"
          style={{ borderTopColor: 'rgba(37, 99, 235, 0.1)' }}
        >
          <div className="flex gap-1 py-2 overflow-x-auto">
            {viewMode === 'buying' ? (
              <>
                <Link
                  to="/post-job"
                  className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap font-medium ${
                    isActive('/post-job') ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                  style={{ color: isActive('/post-job') ? 'rgb(37, 99, 235)' : 'rgb(17, 24, 39)' }}
                >
                  Post a Job
                </Link>
                <Link
                  to="/my-hires"
                  className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap font-medium ${
                    isActive('/my-hires') ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                  style={{ color: isActive('/my-hires') ? 'rgb(37, 99, 235)' : 'rgb(17, 24, 39)' }}
                >
                  My Hires
                </Link>
                <Link
                  to="/browse-freelancers"
                  className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap font-medium ${
                    isActive('/browse-freelancers') ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                  style={{ color: isActive('/browse-freelancers') ? 'rgb(37, 99, 235)' : 'rgb(17, 24, 39)' }}
                >
                  Browse Freelancers
                </Link>
                <Link
                  to="/my-messages"
                  className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap font-medium flex items-center gap-2 ${
                    isActive('/my-messages') ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                  style={{ color: isActive('/my-messages') ? 'rgb(37, 99, 235)' : 'rgb(17, 24, 39)' }}
                >
                  <MessageCircle className="w-4 h-4" />
                  My Messages
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/find-work"
                  className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap font-medium ${
                    isActive('/find-work') ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                  style={{ color: isActive('/find-work') ? 'rgb(37, 99, 235)' : 'rgb(17, 24, 39)' }}
                >
                  Find Work
                </Link>
                <Link
                  to="/my-proposals"
                  className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap font-medium ${
                    isActive('/my-proposals') ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                  style={{ color: isActive('/my-proposals') ? 'rgb(37, 99, 235)' : 'rgb(17, 24, 39)' }}
                >
                  My Proposals
                </Link>
                <Link
                  to="/my-earnings"
                  className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap font-medium ${
                    isActive('/my-earnings') ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                  style={{ color: isActive('/my-earnings') ? 'rgb(37, 99, 235)' : 'rgb(17, 24, 39)' }}
                >
                  My Earnings
                </Link>
                <Link
                  to="/chat-requests"
                  className={`relative px-4 py-2 rounded-lg transition-colors whitespace-nowrap font-medium flex items-center gap-2 ${
                    isActive('/chat-requests') ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                  style={{ color: isActive('/chat-requests') ? 'rgb(37, 99, 235)' : 'rgb(17, 24, 39)' }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat Requests
                  {pendingRequestsCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {pendingRequestsCount}
                    </span>
                  )}
                </Link>
                {currentUser && (
                  <Link
                    to={`/seller/${currentUser.id}`}
                    className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap font-medium ${
                      isActive(`/seller/${currentUser.id}`) ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}
                    style={{ color: isActive(`/seller/${currentUser.id}`) ? 'rgb(37, 99, 235)' : 'rgb(17, 24, 39)' }}
                  >
                    My Profile
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-gray-50 border-t p-4">
          <div className="space-y-2">
            <button
              onClick={() => {
                toggleViewMode();
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 rounded-lg font-medium"
              style={{ color: 'rgb(37, 99, 235)', backgroundColor: 'rgba(37, 99, 235, 0.05)' }}
            >
              {viewMode === 'buying' ? 'Switch to Freelancer Mode' : 'Switch to Client Mode'}
            </button>
            <Link
              to="/wallet"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-100"
            >
              Wallet
            </Link>
            <button
              onClick={() => {
                onLogout();
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-100"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
