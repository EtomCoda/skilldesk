import { useState } from 'react';
import { LogIn, GraduationCap, UserPlus, Lock, Mail, User as UserIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [signupRole, setSignupRole] = useState<'buying' | 'selling'>('buying');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setCurrentUser = useStore((state) => state.setCurrentUser);
  const setViewMode = useStore((state) => state.setViewMode);

  const validateEmail = (email: string) => {
    return email.endsWith('@pau.edu.ng');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!validateEmail(email)) {
      setError('Invalid email. Only @pau.edu.ng emails are allowed.');
      setLoading(false);
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setError('Please enter your full name.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'signup') {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;

        if (authData.user) {
          // Create the profile in the users table
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .insert({
              id: authData.user.id,
              email,
              full_name: fullName,
            })
            .select()
            .maybeSingle();

          if (profileError) {
            // Check if it's a unique constraint violation (email already used)
            if (profileError.code === '23505') {
               throw new Error('This email is already in use by another profile.');
            }
            throw profileError;
          }

          if (profileData) {
            // Initialize wallet
            await supabase
              .from('wallets')
              .insert({
                user_id: authData.user.id,
                available_balance: 0,
                escrow_balance: 0,
              });

            setCurrentUser(profileData);
            setViewMode(signupRole);
            onLogin();
          } else {
            // If inserted but returned nothing, maybe just fetch it
            const { data: fallbackProfile } = await supabase
              .from('users')
              .select('*')
              .eq('id', authData.user.id)
              .maybeSingle();
              
            if (fallbackProfile) {
              setCurrentUser(fallbackProfile);
              setViewMode(signupRole);
              onLogin();
            } else {
              throw new Error('Profile creation failed. Please try again.');
            }
          }
        }
      } else {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) throw authError;

        if (authData.user) {
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (profileError) throw profileError;

          if (!profile) {
            throw new Error(`Profile not found for this user. Please sign up or contact support.`);
          }

          setCurrentUser(profile);
          onLogin();
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-600 shadow-xl shadow-blue-200 mb-4 transform -rotate-6">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">SkillDesk</h1>
          <p className="text-gray-600 mt-2 font-medium">Freelance Marketplace for PAU Students</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
          <div className="flex border-b border-gray-100 text-center">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-4 font-bold transition-all ${
                mode === 'login' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-4 font-bold transition-all ${
                mode === 'signup' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Sign Up
            </button>
          </div>

          <div className="p-8">
            <form onSubmit={handleAuth} className="space-y-5">
              {mode === 'signup' && (
                <>
                  <div className="space-y-3 mb-4">
                    <label className="text-sm font-bold text-gray-700 ml-1">I want to:</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSignupRole('buying')}
                        className={`py-3 px-4 rounded-xl border-2 font-semibold transition-all ${
                          signupRole === 'buying'
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        Hire Talent
                      </button>
                      <button
                        type="button"
                        onClick={() => setSignupRole('selling')}
                        className={`py-3 px-4 rounded-xl border-2 font-semibold transition-all ${
                          signupRole === 'selling'
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        Find Work
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                  <label htmlFor="fullName" className="text-sm font-bold text-gray-700 ml-1">
                    Full Name
                  </label>
                  <div className="relative group">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      required
                    />
                  </div>
                </div>
              </>
            )}

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-bold text-gray-700 ml-1">
                  PAU Email Address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@pau.edu.ng"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-bold text-gray-700 ml-1">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium animate-shake">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : mode === 'login' ? (
                  <>
                    <LogIn className="w-5 h-5" />
                    Login to My Account
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Create Profile
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
