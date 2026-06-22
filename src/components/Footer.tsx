import { Link } from 'react-router-dom';
import { Briefcase, Twitter, Linkedin, Github } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Footer() {
  const { viewMode } = useStore();
  const isClient = viewMode === 'buying';

  // Styling
  const bgClass = isClient ? 'bg-white' : 'bg-[#0E0E52]';
  const borderClass = isClient ? 'border-gray-200' : 'border-[#1c1c68]';
  const textTitle = isClient ? 'text-gray-900' : 'text-white';
  const textDesc = isClient ? 'text-gray-500' : 'text-gray-400';
  const logoText = isClient ? 'text-blue-900' : 'text-white';
  const linkText = isClient ? 'text-gray-500 hover:text-blue-600' : 'text-gray-400 hover:text-white';

  return (
    <footer className={`${bgClass} border-t ${borderClass} mt-auto transition-colors duration-500`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <span className={`font-bold text-xl ${logoText}`}>SkillDesks</span>
            </div>
            <p className={`${textDesc} text-sm mb-6 leading-relaxed`}>
              Connecting talented students with top-tier clients. Building the future of university-based freelancing.
            </p>
            <div className="flex gap-4">
              <a href="#" className={`${linkText} transition-colors`}>
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className={`${linkText} transition-colors`}>
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className={`${linkText} transition-colors`}>
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>

          {isClient ? (
            <div>
              <h3 className={`font-bold ${textTitle} mb-4 uppercase text-sm tracking-wider`}>For Clients</h3>
              <ul className="space-y-3">
                <li><Link to="/" className={`${linkText} text-sm transition-colors`}>My Posted Jobs</Link></li>
                <li><Link to="/browse-freelancers" className={`${linkText} text-sm transition-colors`}>Browse Freelancers</Link></li>
                <li><Link to="/support" className={`${linkText} text-sm transition-colors`}>Trust & Safety</Link></li>
              </ul>
            </div>
          ) : (
            <div>
              <h3 className={`font-bold ${textTitle} mb-4 uppercase text-sm tracking-wider`}>For Freelancers</h3>
              <ul className="space-y-3">
                <li><Link to="/find-work" className={`${linkText} text-sm transition-colors`}>Find Work</Link></li>
                <li><Link to="/my-proposals" className={`${linkText} text-sm transition-colors`}>My Proposals</Link></li>
                <li><Link to="/support" className={`${linkText} text-sm transition-colors`}>Freelancer Success</Link></li>
              </ul>
            </div>
          )}

          <div>
            <h3 className={`font-bold ${textTitle} mb-4 uppercase text-sm tracking-wider`}>SkillDesks</h3>
            <ul className="space-y-3">
              <li><Link to="/support" className={`${linkText} text-sm transition-colors`}>Help & Support</Link></li>
              <li><a href="#" className={`${linkText} text-sm transition-colors`}>Terms of Service</a></li>
              <li><a href="#" className={`${linkText} text-sm transition-colors`}>Privacy Policy</a></li>
            </ul>
          </div>

        </div>
        
        <div className={`border-t ${borderClass} mt-12 pt-8 flex flex-col items-center gap-4`}>
          <p className={`${textDesc} text-sm text-center`}>
            © {new Date().getFullYear()} Horizon by EtomCoda. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
