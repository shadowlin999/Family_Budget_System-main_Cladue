import React, { useState, useEffect, useRef } from 'react';
import { Clock, ChevronDown } from 'lucide-react';

// eslint-disable-next-line react-refresh/only-export-components -- TIMEZONES is a shared data constant; intentional co-location with DigitalClock
export const TIMEZONES = [
  { label: '台灣/香港/北京 (UTC+8)', offset: 480 },
  { label: '日本/韓國 (UTC+9)', offset: 540 },
  { label: '澳洲東部 (UTC+10)', offset: 600 },
  { label: '紐西蘭 (UTC+12)', offset: 720 },
  { label: '泰國/越南 (UTC+7)', offset: 420 },
  { label: '印度 (UTC+5:30)', offset: 330 },
  { label: '阿聯酋 (UTC+4)', offset: 240 },
  { label: '俄羅斯莫斯科 (UTC+3)', offset: 180 },
  { label: '東歐/以色列 (UTC+2)', offset: 120 },
  { label: '英國/GMT (UTC+0)', offset: 0 },
  { label: '巴西聖保羅 (UTC-3)', offset: -180 },
  { label: '美東 (UTC-5)', offset: -300 },
  { label: '美中 (UTC-6)', offset: -360 },
  { label: '美山 (UTC-7)', offset: -420 },
  { label: '美西 (UTC-8)', offset: -480 },
  { label: '夏威夷 (UTC-10)', offset: -600 },
];

interface DigitalClockProps {
  timezoneOffset: number; // in minutes from UTC, e.g. 480 for UTC+8
  onChangeTimezone?: (offset: number) => void; // only provided for admin
  isAdmin?: boolean;
}

export const DigitalClock: React.FC<DigitalClockProps> = ({ timezoneOffset, onChangeTimezone }) => {
  const [now, setNow] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Convert to target timezone
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const tzDate = new Date(utcMs + timezoneOffset * 60 * 1000);

  const yyyy = tzDate.getFullYear();
  const mm = String(tzDate.getMonth() + 1).padStart(2, '0');
  const dd = String(tzDate.getDate()).padStart(2, '0');
  const HH = String(tzDate.getHours()).padStart(2, '0');
  const MM = String(tzDate.getMinutes()).padStart(2, '0');
  const SS = String(tzDate.getSeconds()).padStart(2, '0');

  const tzInfo = TIMEZONES.find(t => t.offset === timezoneOffset);
  const tzShort = tzInfo
    ? tzInfo.label.match(/\(([^)]+)\)/)?.[1] ?? ''
    : `UTC${timezoneOffset >= 0 ? '+' : ''}${(timezoneOffset / 60).toFixed(1).replace('.0', '')}`;

  const canChange = !!onChangeTimezone;

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => canChange && setShowPicker(v => !v)}
        className={`flex flex-col items-end gap-0.5 select-none ${canChange ? 'cursor-pointer hover:opacity-75' : 'cursor-default'} transition-opacity`}
        title={canChange ? '點擊切換時區' : undefined}
      >
        <div className="flex items-center gap-1.5">
          <Clock size={12} className="text-primary/60 flex-shrink-0" />
          <span className="font-mono text-sm font-black tracking-widest text-white tabular-nums">
            {HH}:{MM}:{SS}
          </span>
        </div>
        <div className="font-mono text-[11px] text-slate-400 tabular-nums">
          {yyyy}/{mm}/{dd}
        </div>
        <div className="flex items-center gap-0.5 text-[10px] text-primary/50">
          <span>{tzShort}</span>
          {canChange && <ChevronDown size={9} />}
        </div>
      </button>

      {showPicker && canChange && (
        <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-white/10 rounded-2xl w-64 z-[200] shadow-2xl overflow-hidden">
          <div className="px-4 pt-3 pb-2 text-xs font-bold text-slate-400 border-b border-white/10 flex items-center gap-2">
            <Clock size={12} /> 選擇時區
          </div>
          <div className="max-h-72 overflow-y-auto">
            {TIMEZONES.map(tz => (
              <button
                key={tz.offset}
                type="button"
                onClick={() => { onChangeTimezone!(tz.offset); setShowPicker(false); }}
                className={`w-full text-left px-4 py-2.5 text-xs hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 ${
                  tz.offset === timezoneOffset ? 'text-primary font-bold bg-primary/10' : 'text-slate-300'
                }`}
              >
                {tz.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
