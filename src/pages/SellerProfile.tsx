import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, MessageCircle, Plus, Edit3 } from 'lucide-react';
import { supabase, User as UserType } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface Portfolio {
  id: string;
  title: string;
  description: string;
  image_url: string;
  link?: string;
  category: string;
  created_at: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  reviewer_id: string;
  reviewer: UserType;
  created_at: string;
}

interface SellerStats {
  total_jobs_completed: number;
  average_rating: number;
  total_reviews: number;
}

export default function SellerProfile() {
  const { sellerId } = useParams();
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [seller, setSeller] = useState<UserType | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatData, setChatData] = useState({ jobTitle: '', budget: '', description: '' });
  const [sending, setSending] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editSkills, setEditSkills] = useState('');
  const setCurrentUser = useStore((state) => state.setCurrentUser);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sellerId) {
      fetchSellerProfile();
    }
  }, [sellerId]);

  const fetchSellerProfile = async () => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', sellerId)
        .single();

      setSeller(userData);

      const { data: portfolioData } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('freelancer_id', sellerId)
        .order('created_at', { ascending: false });

      setPortfolio(portfolioData || []);

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*, reviewer:reviewer_id(id, full_name, avatar_url)')
        .eq('reviewee_id', sellerId)
        .order('created_at', { ascending: false });

      setReviews(reviewsData || []);

      const { data: statsData } = await supabase
        .from('seller_stats')
        .select('*')
        .eq('user_id', sellerId)
        .maybeSingle();

      if (statsData) {
        setStats(statsData);
      }
    } catch (err) {
      console.error('Error fetching seller profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendChatRequest = async () => {
    if (!currentUser || !seller || !chatData.jobTitle || !chatData.budget || !chatData.description) {
      alert('Please fill in all fields');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.from('chat_requests').insert({
        buyer_id: currentUser.id,
        seller_id: seller.id,
        job_title: chatData.jobTitle,
        budget: parseFloat(chatData.budget),
        description: chatData.description,
        status: 'pending',
      });

      if (error) throw error;

      alert('Chat request sent! The freelancer will review your request soon.');
      setShowChatModal(false);
      setChatData({ jobTitle: '', budget: '', description: '' });
    } catch (err) {
      console.error('Error sending chat request:', err);
      alert('Failed to send chat request');
    } finally {
      setSending(false);
    }
  };

  const openEditModal = () => {
    setEditBio(seller?.bio || '');
    setEditSkills(seller?.skills || '');
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ bio: editBio, skills: editSkills })
        .eq('id', currentUser.id)
        .select()
        .single();
      
      if (error) throw error;
      
      setSeller(data);
      setCurrentUser(data);
      setShowEditModal(false);
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Error updating profile:', err);
      alert('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-gray-600">Loading seller profile...</p>
        </div>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-gray-600">Seller not found</p>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === seller.id;
  const averageRating = stats?.average_rating || 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
          <div className="flex flex-col md:flex-row gap-6 mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-3xl font-bold" style={{ color: 'rgb(37, 99, 235)' }}>
                {seller.full_name.charAt(0)}
              </span>
            </div>

            <div className="flex-1">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{seller.full_name}</h1>
                  <p className="text-gray-600 mt-1">{seller.email}</p>
                </div>
                {isOwnProfile && (
                  <button
                    onClick={openEditModal}
                    className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Profile
                  </button>
                )}
              </div>

              {stats && (
                <div className="flex flex-wrap gap-6 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Jobs Completed</p>
                    <p className="text-2xl font-bold" style={{ color: 'rgb(37, 99, 235)' }}>
                      {stats.total_jobs_completed}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Average Rating</p>
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-bold" style={{ color: 'rgb(37, 99, 235)' }}>
                        {averageRating.toFixed(1)}
                      </span>
                      <Star className="w-5 h-5" style={{ color: 'rgb(37, 99, 235)' }} />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Reviews</p>
                    <p className="text-2xl font-bold" style={{ color: 'rgb(37, 99, 235)' }}>
                      {stats.total_reviews}
                    </p>
                  </div>
                </div>
              )}

              {seller.skills && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {seller.skills.split(',').map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 rounded-full text-sm font-medium"
                        style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'rgb(37, 99, 235)' }}
                      >
                        {skill.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {seller.bio && (
                <div className="mb-4">
                  <p className="text-gray-700">{seller.bio}</p>
                </div>
              )}

              {!isOwnProfile && currentUser && (
                <button
                  onClick={() => setShowChatModal(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all hover:shadow-lg"
                  style={{ backgroundColor: 'rgb(37, 99, 235)' }}
                >
                  <MessageCircle className="w-5 h-5" />
                  Send Chat Request
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Portfolio</h2>
                {isOwnProfile && (
                  <button
                    onClick={() => navigate('/portfolio/new')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold transition-all hover:shadow-lg"
                    style={{ backgroundColor: 'rgb(37, 99, 235)' }}
                  >
                    <Plus className="w-5 h-5" />
                    Add Project
                  </button>
                )}
              </div>

              {portfolio.length === 0 ? (
                <p className="text-gray-600 text-center py-12">
                  {isOwnProfile ? 'No portfolio items yet. Add your first project!' : 'This seller has no portfolio items yet'}
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {portfolio.map((item) => (
                    <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-48 object-cover"
                      />
                      <div className="p-4">
                        <p className="text-xs font-semibold uppercase" style={{ color: 'rgb(37, 99, 235)' }}>
                          {item.category}
                        </p>
                        <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                        <div className="flex gap-2">
                          {item.link && (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white text-center transition-all hover:shadow-md"
                              style={{ backgroundColor: 'rgb(37, 99, 235)' }}
                            >
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Reviews ({reviews.length})</h2>

              {reviews.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-8">No reviews yet</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b border-gray-200 pb-4 last:border-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className="w-4 h-4"
                              style={{
                                color: i < review.rating ? 'rgb(37, 99, 235)' : '#d1d5db',
                                fill: i < review.rating ? 'rgb(37, 99, 235)' : 'none',
                              }}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{review.rating}.0</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{review.comment}</p>
                      <p className="text-xs text-gray-500">
                        by {review.reviewer?.full_name || 'Anonymous'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Send Chat Request</h2>
            <p className="text-gray-600 mb-6">
              Provide job details and your budget. {seller.full_name} will review and accept or decline.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Job Title</label>
                <input
                  type="text"
                  value={chatData.jobTitle}
                  onChange={(e) => setChatData({ ...chatData, jobTitle: e.target.value })}
                  placeholder="e.g., Logo Design"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Budget (₦)</label>
                <input
                  type="number"
                  value={chatData.budget}
                  onChange={(e) => setChatData({ ...chatData, budget: e.target.value })}
                  placeholder="5000"
                  min="0"
                  step="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Job Description</label>
                <textarea
                  value={chatData.description}
                  onChange={(e) => setChatData({ ...chatData, description: e.target.value })}
                  placeholder="Describe your project needs..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowChatModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendChatRequest}
                  disabled={sending}
                  className="flex-1 px-4 py-2 rounded-lg font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50"
                  style={{ backgroundColor: 'rgb(37, 99, 235)' }}
                >
                  {sending ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Profile</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell clients about yourself..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Skills <span className="text-gray-400 font-normal">(comma separated)</span>
                </label>
                <input
                  type="text"
                  value={editSkills}
                  onChange={(e) => setEditSkills(e.target.value)}
                  placeholder="e.g. Graphic Design, Video Editing, Writing"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex-1 px-4 py-3 rounded-lg font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
                  style={{ backgroundColor: 'rgb(37, 99, 235)' }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
