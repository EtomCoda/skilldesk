import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ArrowLeft, Link as LinkIcon, Image } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

const CATEGORIES = [
  'Graphic Design',
  'Web Development',
  'Video Editing',
  'Writing & Content',
  'Photography',
  'UI/UX Design',
  'Data Science',
  'Marketing',
  'Music & Audio',
  'Other',
];

export default function AddPortfolioItem() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentUser) {
      setError('You must be logged in.');
      return;
    }

    if (!imageUrl.trim()) {
      setError('Please provide an image URL for your project.');
      return;
    }

    setLoading(true);
    try {
      const { error: insertError } = await supabase
        .from('portfolio_items')
        .insert({
          freelancer_id: currentUser.id,
          title: title.trim(),
          description: description.trim(),
          image_url: imageUrl.trim(),
          link: link.trim() || null,
          category,
        });

      if (insertError) throw insertError;

      navigate(`/seller/${currentUser.id}`);
    } catch (err) {
      console.error('Error adding portfolio item:', err);
      setError('Failed to add portfolio item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 mb-6 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Profile
        </button>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-blue-950">Add Portfolio Project</h1>
              <p className="text-gray-500 text-sm">Showcase your best work to attract clients</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-2">
                Project Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Brand Identity for TechCo"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-2">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the project, your role, tools used, and results achieved..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                required
              />
            </div>

            {/* Image URL */}
            <div>
              <label htmlFor="imageUrl" className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="flex items-center gap-1.5">
                  <Image className="w-4 h-4" />
                  Project Image URL
                </span>
              </label>
              <input
                id="imageUrl"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/my-project-image.jpg"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Tip: Upload your image to a service like <a href="https://imgur.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">Imgur</a> or <a href="https://imgbb.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">ImgBB</a> and paste the link here.
              </p>
            </div>

            {/* Live link (optional) */}
            <div>
              <label htmlFor="link" className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="flex items-center gap-1.5">
                  <LinkIcon className="w-4 h-4" />
                  Project Link <span className="text-gray-400 font-normal">(optional)</span>
                </span>
              </label>
              <input
                id="link"
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://your-live-project.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-950 text-white rounded-lg font-semibold hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Add to Portfolio'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
