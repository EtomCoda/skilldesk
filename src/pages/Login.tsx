import { useState, useEffect } from 'react';
import { LogIn, GraduationCap, UserPlus, Lock, Mail, User as UserIcon, ArrowLeft, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot_password' | 'update_password'>('login');
  const [signupRole, setSignupRole] = useState<'buying' | 'selling'>('buying');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const setCurrentUser = useStore((state) => state.setCurrentUser);
  const setViewMode = useStore((state) => state.setViewMode);

  useEffect(() => {
    // Check if we arrived here from a password reset link
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update_password');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);


  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);


    if (mode === 'signup' && !fullName.trim()) {
      setError('Please enter your full name.');
      setLoading(false);
      return;
    }

    if (mode !== 'forgot_password') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setLoading(false);
        return;
      }
    }

    try {
      if (mode === 'signup') {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: signupRole,
            },
          },
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

            setSignupSuccess(true);
          } else {
            // If inserted but returned nothing, maybe just fetch it
            const { data: fallbackProfile } = await supabase
              .from('users')
              .select('*')
              .eq('id', authData.user.id)
              .maybeSingle();
              
            if (fallbackProfile) {
              setSignupSuccess(true);
            } else {
              throw new Error('Profile creation failed. Please try again.');
            }
          }
        }
      } else if (mode === 'login') {
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
      } else if (mode === 'forgot_password') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (resetError) throw resetError;
        setMessage('Password reset link sent! Check your inbox.');
      } else if (mode === 'update_password') {
        const { error: updateError } = await supabase.auth.updateUser({
          password: password,
        });
        if (updateError) throw updateError;
        setMessage('Password updated successfully! You can now login.');
        setMode('login');
      }
    } catch (err: any) {
      const errMsg = String(err?.message || '');
      const isNetworkError = 
        !navigator.onLine || 
        /failed to fetch/i.test(errMsg) || 
        /load failed/i.test(errMsg) || 
        /networkerror/i.test(errMsg) || 
        /fetch failed/i.test(errMsg);

      if (isNetworkError) {
        setError('Network connection lost. Please check your internet connection and try again.');
      } else if (err.message?.includes('over_email_send_rate_limit') || err.code === 'over_email_send_rate_limit') {
        setError('Too many emails have been sent to this email address. Please wait a while before trying again.');
      } else {
        setError(err.message || 'An error occurred. Please try again.');
      }
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
          <p className="text-gray-600 mt-2 font-medium">Freelance Marketplace</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
          {(mode === 'login' || mode === 'signup') && (
            <div className="flex border-b border-gray-100 text-center">
              <button
                onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                className={`flex-1 py-4 font-bold transition-all ${
                  mode === 'login' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
                className={`flex-1 py-4 font-bold transition-all ${
                  mode === 'signup' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {mode === 'forgot_password' && (
            <div className="flex items-center p-4 border-b border-gray-100">
              <button 
                onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                className="p-2 hover:bg-gray-50 rounded-lg text-gray-500 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="flex-1 text-center font-bold text-gray-800 pr-9">Reset Password</h2>
            </div>
          )}

          {mode === 'update_password' && (
            <div className="p-6 border-b border-gray-100 text-center">
              <h2 className="text-xl font-bold text-gray-800">Set New Password</h2>
              <p className="text-sm text-gray-500 mt-1">Please enter a new secure password</p>
            </div>
          )}

          <div className="p-8">
            {signupSuccess ? (
              <div className="text-center py-8 space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-2">
                  <Mail className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Confirm Your Email</h3>
                <p className="text-gray-600">
                  A verification link has been sent to <span className="font-semibold text-blue-600">{email}</span>. 
                  Please click the link in the email to activate your account. <strong>After clicking, you will be automatically logged into the application.</strong>
                </p>
                <button
                  onClick={() => {
                    setSignupSuccess(false);
                    setMode('login');
                  }}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all mt-4"
                >
                  Back to Login
                </button>
              </div>
            ) : (
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

                {mode !== 'update_password' && (
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-sm font-bold text-gray-700 ml-1">
                      Email Address
                    </label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                        required
                      />
                    </div>
                  </div>
                )}

                {mode !== 'forgot_password' && (
                  <div className="space-y-1.5">
                    <label htmlFor="password" className="text-sm font-bold text-gray-700 ml-1">
                      {mode === 'update_password' ? 'New Password' : 'Password'}
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {mode === 'login' && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => { setMode('forgot_password'); setError(''); setMessage(''); }}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium animate-shake">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="bg-green-50 border border-green-100 text-green-700 px-4 py-3 rounded-xl text-sm font-medium">
                    {message}
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
                  ) : mode === 'forgot_password' ? (
                    <>
                      <Mail className="w-5 h-5" />
                      Send Reset Link
                    </>
                  ) : mode === 'update_password' ? (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      Update Password
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      Create Profile
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
