import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, MessageCircle, Plus, Edit3, Trash2, X, ExternalLink } from 'lucide-react';
import { supabase, User as UserType } from '../lib/supabase';
import { useStore } from '../store/useStore';
import SkillInput from '../components/SkillInput';
import { useToast } from '../lib/toast';
import PortfolioItemSkeleton from '../components/PortfolioItemSkeleton';
import { ConfirmModal } from '../components/ConfirmModal';

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
  const [editSkills, setEditSkills] = useState<string[]>([]);
  
  // Portfolio Editing State
  const [editingItem, setEditingItem] = useState<Portfolio | null>(null);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [portfolioSaving, setPortfolioSaving] = useState(false);
  const [portfolioDeleting, setPortfolioDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const setCurrentUser = useStore((state) => state.setCurrentUser);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (sellerId) {
      fetchSellerProfile();
    }
  }, [sellerId]);

  useEffect(() => {
    // Automatically open edit modal if onboarding param is present and viewing own profile
    const params = new URLSearchParams(window.location.search);
    if (params.get('onboarding') === 'true' && sellerId === currentUser?.id && !loading && seller) {
      openEditModal();
      // Remove query param from URL without refreshing to avoid re-opening on manual refresh
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [sellerId, currentUser, loading, seller]);

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

  const handleUpdatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setPortfolioSaving(true);
    try {
      const { error } = await supabase
        .from('portfolio_items')
        .update({
          title: editingItem.title,
          description: editingItem.description,
          category: editingItem.category,
          link: editingItem.link,
          image_url: editingItem.image_url
        })
        .eq('id', editingItem.id);

      if (error) throw error;

      toast.success('Project updated successfully.');
      setShowPortfolioModal(false);
      setEditingItem(null);
      fetchSellerProfile();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update project');
    } finally {
      setPortfolioSaving(false);
    }
  };

  const handleDeletePortfolio = async (id: string) => {
    setShowDeleteConfirm(null);
    setPortfolioDeleting(true);
    try {
      const { error } = await supabase
        .from('portfolio_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Project deleted successfully.');
      fetchSellerProfile();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete project');
    } finally {
      setPortfolioDeleting(false);
    }
  };

  const handleSendChatRequest = async () => {
    if (!currentUser || !seller || !chatData.jobTitle || !chatData.budget || !chatData.description) {
      toast.warning('Please fill in all fields.');
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

      toast.success('The freelancer will review your request soon.', 'Chat Request Sent!');
      setShowChatModal(false);
      setChatData({ jobTitle: '', budget: '', description: '' });
    } catch (err) {
      console.error('Error sending chat request:', err);
      toast.error('Failed to send chat request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const openEditModal = () => {
    setEditBio(seller?.bio || '');
    // Parse existing comma-separated skills string into an array
    const existingSkills = seller?.skills
      ? seller.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];
    setEditSkills(existingSkills);
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    
    const trimmedBio = editBio.trim();
    if (trimmedBio.length > 0 && trimmedBio.length < 20) {
      toast.warning('Please provide a bio of at least 20 characters.');
      return;
    }

    if (editSkills.length > 15) {
      toast.warning('Please limit your skills to 15 items.');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          bio: trimmedBio,
          skills: editSkills.join(', ')
        })
        .eq('id', currentUser.id)
        .select()
        .single();
      
      if (error) throw error;
      
      setSeller(data);
      setCurrentUser(data);
      setShowEditModal(false);
      toast.success('Your profile has been updated.', 'Profile Saved!');
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-sm p-8 mb-6 animate-pulse">
            <div className="flex flex-col md:flex-row gap-6 mb-8">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex-shrink-0"></div>
              <div className="flex-1">
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <PortfolioItemSkeleton key={i} />
            ))}
          </div>
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
                    <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                      <div className="relative group">
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-full h-48 object-cover"
                        />
                        {isOwnProfile && (
                          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setShowPortfolioModal(true);
                              }}
                              className="p-2 bg-white rounded-full shadow-lg text-gray-600 hover:text-blue-600 transition-colors"
                              title="Edit Project"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(item.id)}
                              disabled={portfolioDeleting}
                              className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                              title="Delete Project"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                        <p className="text-xs font-semibold uppercase mb-1" style={{ color: 'rgb(37, 99, 235)' }}>
                          {item.category}
                        </p>
                        <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-3 overflow-hidden flex-1">{item.description}</p>
                        <div className="flex gap-2">
                          {item.link && (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white text-center transition-all hover:shadow-md"
                              style={{ backgroundColor: 'rgb(37, 99, 235)' }}
                            >
                              <ExternalLink className="w-4 h-4" />
                              View Project
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

      {/* Portfolio Item Edit Modal */}
      {showPortfolioModal && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-900">Edit Project</h2>
              <button onClick={() => { setShowPortfolioModal(false); setEditingItem(null); }} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleUpdatePortfolio} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project Title</label>
                <input
                  type="text"
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  >
                    <option value="Web Development">Web Development</option>
                    <option value="Mobile Apps">Mobile Apps</option>
                    <option value="UI/UX Design">UI/UX Design</option>
                    <option value="Graphic Design">Graphic Design</option>
                    <option value="Content Writing">Content Writing</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                    <option value="Data Science">Data Science</option>
                    <option value="E-commerce">E-commerce</option>
                    <option value="AI & ML">AI & ML</option>
                    <option value="Blockchain">Blockchain</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project Link (Optional)</label>
                  <input
                    type="url"
                    value={editingItem.link || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, link: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail URL</label>
                <input
                  type="url"
                  value={editingItem.image_url}
                  onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div className="flex gap-4 pt-4 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => { setShowPortfolioModal(false); setEditingItem(null); }}
                  className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={portfolioSaving}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
                >
                  {portfolioSaving ? 'Saving...' : 'Update Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Bio</label>
                  <span className={`text-[10px] font-medium ${editBio.length < 20 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {editBio.length} / 500 characters (min 20)
                  </span>
                </div>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value.slice(0, 500))}
                  placeholder="Tell clients about your experience, expertise, and what makes you unique..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm"
                />
                <p className="text-[10px] text-gray-400 mt-1">A professional bio helps you stand out. Avoid all-caps or excessive emojis.</p>
              </div>

              <div>
                <SkillInput
                  skills={editSkills}
                  onChange={setEditSkills}
                  label="Your Skills"
                />
                <div className="flex justify-between mt-1">
                  <p className="text-[10px] text-gray-400">Add up to 15 skills to help clients find you.</p>
                  <span className={`text-[10px] font-medium ${editSkills.length >= 15 ? 'text-red-500' : 'text-gray-400'}`}>
                    {editSkills.length} / 15
                  </span>
                </div>
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

      <ConfirmModal
        isOpen={!!showDeleteConfirm}
        title="Delete Project"
        message="Are you sure you want to delete this project?"
        confirmText="Yes, Delete"
        isDestructive
        onConfirm={() => showDeleteConfirm && handleDeletePortfolio(showDeleteConfirm)}
        onCancel={() => setShowDeleteConfirm(null)}
      />
    </div>
  );

}
