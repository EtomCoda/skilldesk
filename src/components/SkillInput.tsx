import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';

export const SUGGESTED_SKILLS = [
  'React', 'Node.js', 'Python', 'TypeScript', 'JavaScript',
  'UI/UX Design', 'Graphic Design', 'Video Editing', 'Content Writing',
  'SEO', 'Social Media Marketing', 'Data Analysis', 'Excel/Spreadsheets',
  'WordPress', 'Figma', 'Photoshop', 'Mobile Development', 'Copywriting',
  'Voice Over', 'Photography',
];

function toTitleCase(str: string) {
  return str.trim().replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

interface SkillInputProps {
  skills: string[];
  onChange: (skills: string[]) => void;
  label?: string;
  optional?: boolean;
}

export default function SkillInput({ skills, onChange, label = 'Required Skills', optional = false }: SkillInputProps) {
  const [inputVal, setInputVal] = useState('');

  const addSkill = (raw: string) => {
    const formatted = toTitleCase(raw.replace(/,/g, '').trim());
    if (!formatted) return;
    if (skills.some((s) => s.toLowerCase() === formatted.toLowerCase())) return;
    onChange([...skills, formatted]);
    setInputVal('');
  };

  const removeSkill = (idx: number) => {
    onChange(skills.filter((_, i) => i !== idx));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(inputVal);
    } else if (e.key === 'Backspace' && inputVal === '' && skills.length > 0) {
      onChange(skills.slice(0, -1));
    }
  };

  const unselected = SUGGESTED_SKILLS.filter(
    (s) => !skills.some((chosen) => chosen.toLowerCase() === s.toLowerCase())
  );

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}{' '}
        {optional && <span className="text-gray-400 font-normal">(optional)</span>}
      </label>

      {/* Pills + text input */}
      <div className="flex flex-wrap gap-2 min-h-[46px] px-3 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-950 focus-within:border-transparent bg-white">
        {skills.map((s, i) => (
          <span
            key={i}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full"
          >
            {s}
            <button
              type="button"
              onClick={() => removeSkill(i)}
              className="text-blue-500 hover:text-blue-800 transition-colors leading-none"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => { if (inputVal.trim()) addSkill(inputVal); }}
          placeholder={skills.length === 0 ? 'Type a skill and press Enter…' : ''}
          className="flex-1 min-w-[160px] outline-none bg-transparent text-sm py-0.5"
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">Press Enter or comma to add · Backspace to remove last</p>

      {/* Suggestions */}
      {unselected.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 font-medium mb-2">Common skills — click to add:</p>
          <div className="flex flex-wrap gap-1.5">
            {unselected.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => addSkill(skill)}
                className="px-2.5 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 text-xs font-medium rounded-full border border-gray-200 hover:border-blue-200 transition-colors"
              >
                + {skill}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
