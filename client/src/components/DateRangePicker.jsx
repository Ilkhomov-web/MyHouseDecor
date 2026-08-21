import { useEffect, useMemo, useRef, useState } from 'react';
import { IconCalendar, IconChevronLeft, IconChevronRight } from './icons/Icons';

const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];
const MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
// Hafta dushanbadan boshlanadi.
const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

// Sanalar mahalliy vaqt bo'yicha ishlanadi — toISOString() UTC'ga o'tkazib,
// kechqurun tanlangan kunni bir kun oldinga surib yuborardi.
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parse = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
};

const label = (s) => {
  const d = parse(s);
  return d ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` : '';
};

function triggerText(from, to) {
  if (!from && !to) return 'Barcha sanalar';
  if (from && !to) return `${label(from)} dan`;
  if (!from && to) return `${label(to)} gacha`;
  if (from === to) return `${label(from)} ${parse(from).getFullYear()}`;
  return `${label(from)} – ${label(to)} ${parse(to).getFullYear()}`;
}

/** Oy uchun 6 qatorlik (42 katak) to'liq grid — qo'shni oy kunlari ham kiradi. */
function monthGrid(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // dushanba = 0
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  return Array.from(
    { length: 42 },
    (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
  );
}

/**
 * iOS uslubidagi sana oralig'i tanlagich.
 *
 * Birinchi bosish oraliqni boshlaydi, ikkinchisi yakunlaydi va darhol qo'llanadi
 * (teskari tartibda bosilsa, sanalar almashtiriladi). Tayyor shablonlar bir
 * bosishda ishlaydi.
 */
export default function DateRangePicker({ value, onChange }) {
  const { from = '', to = '' } = value || {};
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });
  const [anchor, setAnchor] = useState(() => parse(from) || new Date());
  const wrapRef = useRef(null);

  // Tashqi qiymat o'zgarsa (masalan "Tozalash"), qoralama ham yangilanadi.
  useEffect(() => {
    setDraft({ from, to });
  }, [from, to]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const days = useMemo(() => monthGrid(anchor), [anchor]);
  const todayIso = iso(new Date());

  const apply = (next) => {
    setDraft(next);
    onChange(next);
  };

  const pickDay = (d) => {
    const picked = iso(d);
    // Oraliq boshlanmagan yoki allaqachon to'liq bo'lsa — yangisini boshlaymiz.
    if (!draft.from || draft.to) {
      setDraft({ from: picked, to: '' });
      return;
    }
    const next =
      picked < draft.from ? { from: picked, to: draft.from } : { from: draft.from, to: picked };
    apply(next);
    setOpen(false);
  };

  const preset = (key) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let next = { from: '', to: '' };
    if (key === 'today') next = { from: iso(now), to: iso(now) };
    if (key === 'week') next = { from: iso(new Date(y, m, now.getDate() - 6)), to: iso(now) };
    if (key === 'month') next = { from: iso(new Date(y, m, 1)), to: iso(now) };
    // 0-kun — oldingi oyning oxirgi kuni.
    if (key === 'prev') next = { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    apply(next);
    if (next.from) setAnchor(parse(next.from));
    setOpen(false);
  };

  const shiftMonth = (delta) =>
    setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1));

  const rangeEnd = draft.to || draft.from;
  const active = Boolean(from || to);

  return (
    <div className="dp" ref={wrapRef}>
      <button
        type="button"
        className={`btn btn-secondary dp-trigger${active ? ' is-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <IconCalendar size={16} />
        {triggerText(from, to)}
      </button>

      {open && (
        <div className="dp-panel" role="dialog" aria-label="Sana oraligini tanlash">
          <div className="dp-presets">
            <button type="button" className="dp-chip" onClick={() => preset('today')}>
              Bugun
            </button>
            <button type="button" className="dp-chip" onClick={() => preset('week')}>
              7 kun
            </button>
            <button type="button" className="dp-chip" onClick={() => preset('month')}>
              Shu oy
            </button>
            <button type="button" className="dp-chip" onClick={() => preset('prev')}>
              O'tgan oy
            </button>
          </div>

          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={() => shiftMonth(-1)} aria-label="Oldingi oy">
              <IconChevronLeft size={16} />
            </button>
            <div className="dp-month">
              {MONTHS[anchor.getMonth()]} <span>{anchor.getFullYear()}</span>
            </div>
            <button type="button" className="dp-nav" onClick={() => shiftMonth(1)} aria-label="Keyingi oy">
              <IconChevronRight size={16} />
            </button>
          </div>

          <div className="dp-grid dp-weekdays">
            {WEEKDAYS.map((w) => (
              <div key={w} className="dp-wd">
                {w}
              </div>
            ))}
          </div>

          <div className="dp-grid">
            {days.map((d) => {
              const key = iso(d);
              const outside = d.getMonth() !== anchor.getMonth();
              const isStart = Boolean(draft.from) && key === draft.from;
              const isEnd = Boolean(rangeEnd) && key === rangeEnd;
              const inRange = Boolean(draft.from && rangeEnd) && key >= draft.from && key <= rangeEnd;
              const cell = ['dp-cell', inRange && 'in-range', isStart && 'range-start', isEnd && 'range-end']
                .filter(Boolean)
                .join(' ');
              const day = [
                'dp-day',
                outside && 'is-outside',
                (isStart || isEnd) && 'is-selected',
                key === todayIso && 'is-today',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <div key={key} className={cell}>
                  <button type="button" className={day} onClick={() => pickDay(d)}>
                    {d.getDate()}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="dp-foot">
            <button
              type="button"
              className="dp-link"
              onClick={() => {
                apply({ from: '', to: '' });
                setOpen(false);
              }}
            >
              Tozalash
            </button>
            <button
              type="button"
              className="dp-done"
              onClick={() => {
                // Yakunlanmagan oraliq bitta kun sifatida qo'llanadi.
                if (draft.from && !draft.to) apply({ from: draft.from, to: draft.from });
                setOpen(false);
              }}
            >
              Tayyor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
