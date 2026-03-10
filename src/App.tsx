import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PostJob from './pages/PostJob';
import FindWork from './pages/FindWork';
import JobDetails from './pages/JobDetails';
import Chat from './pages/Chat';
import Wallet from './pages/Wallet';
import MyHires from './pages/MyHires';
import MyProposals from './pages/MyProposals';
import MyEarnings from './pages/MyEarnings';
import BrowseFreelancersAdvanced from './pages/BrowseFreelancersAdvanced';
import SellerProfile from './pages/SellerProfile';
import ReviewJob from './pages/ReviewJob';
import AddPortfolioItem from './pages/AddPortfolioItem';
import ChatRequests from './pages/ChatRequests';
import DirectChat from './pages/DirectChat';
import MyMessages from './pages/MyMessages';
import Messages from './pages/Messages';
import ClientProfile from './pages/ClientProfile';
import Navbar from './components/Navbar';

function App() {
  const [loading, setLoading] = useState(true);
  const { currentUser, setCurrentUser, setWallet } = useStore();

  useEffect(() => {
    let checkTimeout: NodeJS.Timeout;

    // 1. Initial session check with safety timeout
    const checkUser = async () => {
      console.log("🏁 Starting initial session check...");
      
      // Safety timeout: stop spinning after 5 seconds no matter what
      checkTimeout = setTimeout(() => {
        console.warn("⚠️ Initial check exceeded 5s. Forcing spinner to close.");
        setLoading(false);
      }, 5000);

      try {
        if (!supabase) {
          console.error("❌ Supabase client is not initialized!");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        const session = data?.session;
        if (session?.user) {
          console.log("👤 Session found for user:", session.user.id);
          // Don't await forever, if profile fetch is slow the app should still load
          fetchProfile(session.user.id).catch(err => {
            console.error("Error fetching profile:", err);
          });
        } else {
          console.log("ℹ️ No active session found.");
        }
      } catch (error) {
        console.error("❌ Error during initial session check:", error);
      } finally {
        console.log("✅ Initial check code reached finally block.");
        clearTimeout(checkTimeout);
        setLoading(false);
      }
    };

    checkUser();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("🔄 Auth state changed:", _event);
      if (session?.user) {
        fetchProfile(session.user.id).catch(err => console.error(err));
      } else {
        setCurrentUser(null);
        setWallet(null);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (checkTimeout) clearTimeout(checkTimeout);
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (profile) {
      setCurrentUser(profile);
      await fetchWallet(userId);
    }
  };

  const fetchWallet = async (userId: string) => {
    const { data } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (data) {
      setWallet(data);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setWallet(null);
  };

  console.log("App render:", { loading, hasUser: !!currentUser });

  if (loading) {
    console.log("Rendering spinner...");
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    console.log("No user found after loading, rendering Login screen.");
    return <Login onLogin={() => {}} />;
  }

  console.log("User active, rendering main app routers.");
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navbar onLogout={handleLogout} />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/post-job" element={<PostJob />} />
          <Route path="/find-work" element={<FindWork />} />
          <Route path="/job/:jobId" element={<JobDetails />} />
          <Route path="/chat/:jobId" element={<Chat />} />
          <Route path="/review/:jobId" element={<ReviewJob />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/my-hires" element={<MyHires />} />
          <Route path="/my-proposals" element={<MyProposals />} />
          <Route path="/my-earnings" element={<MyEarnings />} />
          <Route path="/browse-freelancers" element={<BrowseFreelancersAdvanced />} />
          <Route path="/seller/:sellerId" element={<SellerProfile />} />
          <Route path="/portfolio/new" element={<AddPortfolioItem />} />
          {/* Legacy routes — kept for deep links */}
          <Route path="/chat-requests" element={<ChatRequests />} />
          <Route path="/direct-chat/:conversationId" element={<DirectChat />} />
          <Route path="/my-messages" element={<MyMessages />} />
          {/* New unified routes */}
          <Route path="/messages" element={<Messages />} />
          <Route path="/client/:clientId" element={<ClientProfile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
