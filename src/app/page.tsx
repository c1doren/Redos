'use client';

import { useState, useEffect, useRef } from 'react';

interface Post {
  id: string;
  title: string;
  body: string;
  url: string;
  subreddit: string;
  score: number;
  createdAt: string;
  similarity: number;
  sentiment: 'positive' | 'negative' | 'neutral';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [selectedSubreddits, setSelectedSubreddits] = useState<string[]>(['webdev', 'DataHoarder', 'personalfinance']);
  const [minScore, setMinScore] = useState(0);
  const [minSimilarity, setMinSimilarity] = useState(35);
  const [selectedSentiment, setSelectedSentiment] = useState<'positive' | 'negative' | 'neutral' | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [useLocalDb, setUseLocalDb] = useState(true);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [newSubredditInput, setNewSubredditInput] = useState('');
  
  const [results, setResults] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [searchedWithLocal, setSearchedWithLocal] = useState(true);

  const [availableSubs, setAvailableSubs] = useState<{ name: string; count: number }[]>([]);
  const [ingestingSubs, setIngestingSubs] = useState<string[]>([]);
  const [customSubs, setCustomSubs] = useState<string[]>([]);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const calendarRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchAvailableSubs = async () => {
    try {
      const res = await fetch(`/api/subreddits?useLocalDb=${useLocalDb}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableSubs(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchAvailableSubs();
  }, [useLocalDb]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let mouse = { x: -1000, y: -1000 };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = 128;
    noiseCanvas.height = 128;
    const noiseCtx = noiseCanvas.getContext('2d');
    if (noiseCtx) {
      const imgData = noiseCtx.createImageData(128, 128);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const val = Math.floor(Math.random() * 255);
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 16;
      }
      noiseCtx.putImageData(imgData, 0, 0);
    }

    const render = () => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (noiseCtx) {
        const pattern = ctx.createPattern(noiseCanvas, 'repeat');
        if (pattern) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = pattern;
          ctx.translate(Math.random() * 10, Math.random() * 10);
          ctx.fillRect(-10, -10, canvas.width + 20, canvas.height + 20);
          ctx.restore();
        }
      }

      ctx.save();
      const gradient = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        0,
        mouse.x,
        mouse.y,
        window.innerWidth > 600 ? 320 : 180
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSearched(true);
    setSearchedWithLocal(useLocalDb);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          subreddits: selectedSubreddits,
          minScore: minScore > 0 ? minScore : undefined,
          sentiment: selectedSentiment || undefined,
          dateFrom: dateFrom || undefined,
          useLocalDb,
          globalSearch,
          minSimilarity,
        }),
      });

      if (!res.ok) {
        throw new Error('Search failed to retrieve results');
      }

      const data = await res.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleSubreddit = (sub: string) => {
    setSelectedSubreddits(prev =>
      prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
    );
  };

  const selectSentiment = (type: 'positive' | 'negative' | 'neutral') => {
    setSelectedSentiment(prev => (prev === type ? null : type));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const applyPreset = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setDateFrom(`${yyyy}-${mm}-${dd}`);
    setCalendarOpen(false);
  };

  const selectDay = (day: number) => {
    const yyyy = currentMonth.getFullYear();
    const mm = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    setDateFrom(`${yyyy}-${mm}-${dd}`);
    setCalendarOpen(false);
  };

  const clearDate = () => {
    setDateFrom('');
    setCalendarOpen(false);
  };

  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const cells = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ day: null, key: `empty-${i}` });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= totalDays; day++) {
      const cellDate = new Date(year, month, day);
      const isDisabled = cellDate > today;
      const isToday = cellDate.getTime() === today.getTime();
      
      cells.push({
        day,
        key: `day-${day}`,
        disabled: isDisabled,
        today: isToday
      });
    }
    
    return cells;
  };

  const isDaySelected = (day: number) => {
    if (!dateFrom) return false;
    const [y, m, d] = dateFrom.split('-').map(Number);
    return (
      y === currentMonth.getFullYear() &&
      m === currentMonth.getMonth() + 1 &&
      d === day
    );
  };

  const getCalendarTriggerLabel = () => {
    if (!dateFrom) return 'Filter by date';
    const [y, m, d] = dateFrom.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    return dateObj.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleAddSubreddit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawInput = newSubredditInput.trim();
    if (!rawInput) return;

    const subName = rawInput.replace(/^r\//i, '');
    if (!subName) return;

    if (!customSubs.includes(subName)) {
      setCustomSubs(prev => [...prev, subName]);
    }
    if (!selectedSubreddits.includes(subName)) {
      setSelectedSubreddits(prev => [...prev, subName]);
    }
    setNewSubredditInput('');
  };

  const handleIngestSubreddit = async (sub: string) => {
    if (ingestingSubs.includes(sub)) return;

    setIngestingSubs(prev => [...prev, sub]);

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subreddit: sub }),
      });

      if (!res.ok) {
        throw new Error('Ingestion failed');
      }

      await fetchAvailableSubs();
    } catch (err) {
      console.error('Ingestion error:', err);
    } finally {
      setIngestingSubs(prev => prev.filter(s => s !== sub));
    }
  };

  const getSubredditPostCount = (sub: string) => {
    const found = availableSubs.find(s => s.name.toLowerCase() === sub.toLowerCase());
    return found ? found.count : 0;
  };

  const getDisplayedSubreddits = () => {
    const allUnique = new Set([
      'webdev',
      'DataHoarder',
      'personalfinance',
      ...availableSubs.map(s => s.name),
      ...customSubs,
      ...selectedSubreddits
    ]);
    return Array.from(allUnique);
  };

  return (
    <div className="app-container">
      <canvas ref={canvasRef} className="interactive-bg-canvas" />
      <div className="noise-overlay" />

      <header className="header">
        <h1 className="logo">Redos</h1>
        <p className="tagline">
          Experience AI-powered concept-based Reddit discovery. Discover threads by absolute intent rather than raw keyword matches.
        </p>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <section className="search-section">
          <div className="db-toggle-container">
            <span className="filter-label">Database Mode</span>
            <div className="db-toggle-switch">
              <button
                type="button"
                className={`db-toggle-option ${useLocalDb ? 'active' : ''}`}
                onClick={() => setUseLocalDb(true)}
              >
                Local JSON (Zero Setup)
              </button>
              <button
                type="button"
                className={`db-toggle-option ${!useLocalDb ? 'active' : ''}`}
                onClick={() => setUseLocalDb(false)}
              >
                PostgreSQL (pgvector)
              </button>
            </div>
          </div>

          <form onSubmit={handleSearch}>
            <div className="search-bar-container">
              <input
                type="text"
                className="search-input"
                placeholder="What concepts are you looking for? e.g. restoring rusty iron, cold backups, high yield interest..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <button type="submit" className="search-button" disabled={loading}>
                {loading ? 'Searching...' : 'Explore'}
              </button>
            </div>
          </form>

          <div className="db-toggle-container" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <span className="filter-label">Search Context</span>
            <div className="db-toggle-switch">
              <button
                type="button"
                className={`db-toggle-option ${globalSearch ? 'active' : ''}`}
                onClick={() => setGlobalSearch(true)}
              >
                Search Globally (All DB)
              </button>
              <button
                type="button"
                className={`db-toggle-option ${!globalSearch ? 'active' : ''}`}
                onClick={() => setGlobalSearch(false)}
              >
                Selected Subreddits
              </button>
            </div>
          </div>

          <div className="filters-grid">
            <div className="filter-group" style={{ gridColumn: 'span 2', opacity: globalSearch ? 0.35 : 1, pointerEvents: globalSearch ? 'none' : 'auto', transition: 'opacity 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <span className="filter-label">Subreddits</span>
                
                <form onSubmit={handleAddSubreddit} style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    className="search-input"
                    style={{ padding: '6px 12px', fontSize: '0.8rem', width: '150px', borderRadius: '4px' }}
                    placeholder="r/subreddit"
                    value={newSubredditInput}
                    onChange={e => setNewSubredditInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="search-button"
                    style={{ position: 'static', padding: '0 12px', fontSize: '0.8rem', borderRadius: '4px' }}
                  >
                    Add
                  </button>
                </form>
              </div>

              <div className="subreddits-list" style={{ marginTop: '6px' }}>
                {getDisplayedSubreddits().map(sub => {
                  const count = getSubredditPostCount(sub);
                  const isIngesting = ingestingSubs.includes(sub);
                  
                  return (
                    <div key={sub} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="checkbox"
                        id={`sub-${sub}`}
                        className="chip-checkbox"
                        checked={selectedSubreddits.includes(sub)}
                        onChange={() => toggleSubreddit(sub)}
                      />
                      <label
                        htmlFor={`sub-${sub}`}
                        className={`chip-label ${isIngesting ? 'ingesting-shimmer' : ''}`}
                        style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
                      >
                        r/{sub}
                        <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                          ({isIngesting ? 'ingesting...' : count})
                        </span>
                      </label>

                      {count === 0 && !isIngesting && (
                        <button
                          type="button"
                          onClick={() => handleIngestSubreddit(sub)}
                          className="calendar-preset-btn"
                          style={{ padding: '4px 8px', fontSize: '0.65rem', borderRadius: '4px', height: '100%' }}
                          title="Ingest posts from Reddit"
                        >
                          Sync
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-label">Sentiment</span>
              <div className="sentiment-options">
                {(['positive', 'negative', 'neutral'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    className={`sentiment-option ${selectedSentiment === type ? 'active' : ''}`}
                    onClick={() => selectSentiment(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <div className="range-container">
                <div className="range-info">
                  <span className="filter-label">Min Upvotes</span>
                  <span>{minScore}+</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="10"
                  className="range-slider"
                  value={minScore}
                  onChange={e => setMinScore(parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="filter-group">
              <div className="range-container">
                <div className="range-info">
                  <span className="filter-label">Relevance Threshold</span>
                  <span>{minSimilarity}%+ Match</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  className="range-slider"
                  value={minSimilarity}
                  onChange={e => setMinSimilarity(parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-label">Created Since</span>
              <div className="custom-calendar-container" ref={calendarRef}>
                <button
                  type="button"
                  className={`calendar-trigger-btn ${calendarOpen ? 'active' : ''}`}
                  onClick={() => setCalendarOpen(!calendarOpen)}
                >
                  <span>{getCalendarTriggerLabel()}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>

                {calendarOpen && (
                  <div className="calendar-dropdown">
                    <div className="calendar-presets">
                      <button type="button" className="calendar-preset-btn" onClick={() => applyPreset(1)}>Today</button>
                      <button type="button" className="calendar-preset-btn" onClick={() => applyPreset(7)}>Past Week</button>
                      <button type="button" className="calendar-preset-btn" onClick={() => applyPreset(30)}>Past Month</button>
                      <button type="button" className="calendar-preset-btn" onClick={() => applyPreset(365)}>Past Year</button>
                    </div>

                    <div className="calendar-header">
                      <button type="button" className="calendar-nav-btn" onClick={prevMonth}>&larr;</button>
                      <span>{MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
                      <button type="button" className="calendar-nav-btn" onClick={nextMonth}>&rarr;</button>
                    </div>

                    <div className="calendar-days-header">
                      {WEEKDAYS.map(d => (
                        <div key={d}>{d}</div>
                      ))}
                    </div>

                    <div className="calendar-grid">
                      {getCalendarDays().map(cell => {
                        if (cell.day === null) {
                          return <div key={cell.key} className="calendar-day-cell empty" />;
                        }
                        
                        return (
                          <button
                            key={cell.key}
                            type="button"
                            disabled={cell.disabled}
                            className={`calendar-day-cell ${isDaySelected(cell.day) ? 'selected' : ''} ${cell.today ? 'today' : ''} ${cell.disabled ? 'disabled' : ''}`}
                            onClick={() => selectDay(cell.day!)}
                          >
                            {cell.day}
                          </button>
                        );
                      })}
                    </div>

                    {dateFrom && (
                      <button type="button" className="calendar-clear-btn" onClick={clearDate}>
                        Clear Date Filter
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="results-section">
          {searched && !loading && !error && (
            <div className="results-count-container">
              <div className="results-count">
                Found {results.length} semantic {results.length === 1 ? 'match' : 'matches'}
              </div>
              <span className="db-status-pill">
                Engine: {searchedWithLocal ? 'Local JSON File' : 'PostgreSQL pgvector'}
              </span>
            </div>
          )}

          {loading && (
            <div className="results-list">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-shimmer" />
                  <div className="skeleton-title" />
                  <div className="skeleton-body">
                    <div className="skeleton-line" style={{ width: '100%' }} />
                    <div className="skeleton-line" style={{ width: '95%' }} />
                    <div className="skeleton-line" style={{ width: '60%' }} />
                  </div>
                  <div className="skeleton-meta">
                    <div className="skeleton-badge" />
                    <div className="skeleton-badge" />
                    <div className="skeleton-badge" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="empty-state" style={{ borderColor: 'hsl(var(--negative))', color: 'hsl(var(--negative))' }}>
              {error}
            </div>
          )}

          {!loading && !error && results.length > 0 && (
            <div className="results-list">
              {results.map((post, idx) => (
                <article
                  key={post.id}
                  className="result-card"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="result-header">
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="result-title-link"
                    >
                      <h2 className="result-title">{post.title}</h2>
                    </a>
                    <span className="similarity-badge">
                      {Math.round(post.similarity)}% Match
                    </span>
                  </div>

                  <p className="result-body">{post.body || '[No body text]'}</p>

                  <div className="result-meta">
                    <span className="subreddit-badge" data-sub={post.subreddit}>
                      r/{post.subreddit}
                    </span>

                    <span className="score-badge">
                      ▲ {post.score} Upvotes
                    </span>

                    <span className="sentiment-badge" data-type={post.sentiment}>
                      {post.sentiment}
                    </span>

                    <span className="time-badge">
                      {formatDate(post.createdAt)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}

          {searched && !loading && !error && results.length === 0 && (
            <div className="empty-state">
              No matching discussions found. Try adjusting your search concept or relax your upvote and sentiment filters.
            </div>
          )}

          {!searched && !loading && (
            <div className="empty-state">
              Enter a search concept above to query r/webdev, r/DataHoarder, and r/personalfinance.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
