import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import SkillInput from '../../components/SkillInput';
import { notify } from '../../lib/notifications';

export default function PostJob() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    const trimmedDesc  = description.trim();

    if (trimmedTitle.length < 10) {
      setError('Job title must be at least 10 characters.');
      return;
    }
    if (trimmedDesc.length < 50) {
      setError('Job description must be at least 50 characters. Be specific so freelancers can give accurate proposals.');
      return;
    }

    setLoading(true);
    if (!currentUser) {
      setError('You must be logged in to post a job');
      setLoading(false);
      return;
    }

    try {
      const min = parseFloat(minBudget);
      const max = parseFloat(maxBudget);
      
      if (isNaN(min) || isNaN(max) || min <= 0 || max <= 0) {
        setError('Please enter valid budget amounts (minimum ₦1000).');
        setLoading(false);
        return;
      }
      if (min > max) {
        setError('Minimum budget cannot be greater than maximum budget.');
        setLoading(false);
        return;
      }

      const { error: insertError, data: insertedJob } = await supabase
        .from('jobs')
        .insert({
          client_id: currentUser.id,
          title: trimmedTitle,
          description: trimmedDesc,
          budget: max,
          min_budget: min,
          max_budget: max,
          required_skills: requiredSkills.length ? requiredSkills.join(', ') : null,
          status: 'open',
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Notify freelancers whose skills overlap with the job's required skills
      if (requiredSkills.length > 0 && insertedJob) {
        const { data: allFreelancers } = await supabase
          .from('users')
          .select('id, skills')
          .neq('id', currentUser.id)
          .not('skills', 'is', null);

        if (allFreelancers) {
          const jobSkillsLower = requiredSkills.map((s) => s.toLowerCase());
          const matchedIds = allFreelancers
            .filter((u) => {
              const userSkills = (u.skills || '').toLowerCase().split(',').map((s: string) => s.trim());
              return userSkills.some((s: string) => jobSkillsLower.some((js) => js.includes(s) || s.includes(js)));
            })
            .map((u) => u.id);

          if (matchedIds.length > 0) {
            await notify(
              matchedIds.map((id) => ({
                user_id: id,
                type: 'new_job',
                title: 'New job matching your skills',
                body: `"${title}" — ₦${min.toLocaleString()} to ₦${max.toLocaleString()}. Apply now!`,
                job_id: insertedJob.id,
              }))
            );
          }
        }
      }

      navigate('/my-hires');
    } catch (err) {
      setError('Failed to post job. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-blue-950" />
            </div>
            <h1 className="text-2xl font-bold text-blue-950">Post a New Job</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="flex justify-between items-end mb-2">
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  Job Title
                </label>
                <span className={`text-[10px] font-medium ${title.length < 10 ? 'text-amber-500' : 'text-gray-400'}`}>
                  {title.length} / 100 chars (min 10)
                </span>
              </div>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                placeholder="e.g., Need a Python Tutor for Weekly Sessions"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-950 focus:border-transparent"
                required
              />
              <p className="text-[10px] text-gray-400 mt-1">Use Title Case. Be specific — good titles attract better proposals.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="minBudget" className="block text-sm font-medium text-gray-700 mb-2">
                  Min Budget (₦)
                </label>
                <input
                  id="minBudget"
                  type="number"
                  value={minBudget}
                  onChange={(e) => setMinBudget(e.target.value)}
                  placeholder="5000"
                  min="1000"
                  step="100"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-950 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label htmlFor="maxBudget" className="block text-sm font-medium text-gray-700 mb-2">
                  Max Budget (₦)
                </label>
                <input
                  id="maxBudget"
                  type="number"
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(e.target.value)}
                  placeholder="20000"
                  min="1000"
                  step="100"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-950 focus:border-transparent"
                  required
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 -mt-3">Set a realistic range. Budgets must be at least ₦1000. Freelancers can negotiate within your range.</p>

            <SkillInput
              skills={requiredSkills}
              onChange={setRequiredSkills}
              label="Required Skills"
              optional
            />

            <div>
              <div className="flex justify-between items-end mb-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Job Description
                </label>
                <span className={`text-[10px] font-medium ${description.length < 50 ? 'text-amber-500' : 'text-gray-400'}`}>
                  {description.length} / 2000 chars (min 50)
                </span>
              </div>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                placeholder="Describe the job: what you need done, key deliverables, timeline, and any tools or skills required..."
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-950 focus:border-transparent text-sm"
                required
              />
              <p className="text-[10px] text-gray-400 mt-1">Be clear and specific. Include deadlines, deliverables, and any relevant context. Avoid sharing personal contact details.</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-950 text-white rounded-lg font-semibold hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Posting...' : 'Post Job'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
