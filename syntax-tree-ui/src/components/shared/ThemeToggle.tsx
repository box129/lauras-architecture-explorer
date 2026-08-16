import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import {
  onThemePreferenceChange,
  readThemePreference,
  setThemePreference,
  type ThemePreference,
} from '../../design/theme';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light theme', icon: Sun },
  { value: 'dark', label: 'Dark theme', icon: Moon },
  { value: 'system', label: 'Follow system theme', icon: Monitor },
];

/** Compact icon group form of the one theme control (THEME_SYSTEM spec). */
export default function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(() => readThemePreference());
  useEffect(() => onThemePreferenceChange(setPreference), []);
  return (
    <div className="obs-theme-toggle" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={preference === value}
          aria-label={label}
          title={label}
          className={preference === value ? 'obs-theme-toggle__option obs-theme-toggle__option--active' : 'obs-theme-toggle__option'}
          onClick={() => {
            setThemePreference(value);
            setPreference(value);
          }}
        >
          <Icon size={14} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}
