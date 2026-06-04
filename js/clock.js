// ───────────────────────────────────────────────
// Clock + weather block.
// Time: live Bangkok time (UTC+7), updates every second.
// Weather: fetched from wttr.in (free, no API key), refreshed every 10 min.
// ───────────────────────────────────────────────

const TIMEZONE = 'Asia/Bangkok';
const CITY = 'Bangkok';
const WEATHER_URL = `https://wttr.in/${encodeURIComponent(CITY)}?format=j1`;
const FALLBACK_WEATHER = 'MOSTLY CLEAR';

function formatTime() {
  // Format like "5:10 AM" using browser Intl with TZ override
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return fmt.format(new Date()).toUpperCase().replace(/\s+/g, ' ');
}

function startTimeTicker(el) {
  const update = () => { el.textContent = formatTime(); };
  update();
  setInterval(update, 1000);
}

async function fetchWeather(el) {
  try {
    const res = await fetch(WEATHER_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error('weather http ' + res.status);
    const data = await res.json();
    const desc = data?.current_condition?.[0]?.weatherDesc?.[0]?.value;
    if (desc) {
      el.textContent = desc.toUpperCase();
      return;
    }
    throw new Error('no weatherDesc');
  } catch (err) {
    console.warn('[NYM] weather fallback:', err.message);
    el.textContent = FALLBACK_WEATHER;
  }
}

export function startClock() {
  const timeEl = document.getElementById('clock-time');
  const wxEl = document.getElementById('clock-wx');
  if (timeEl) startTimeTicker(timeEl);
  if (wxEl) {
    fetchWeather(wxEl);
    setInterval(() => fetchWeather(wxEl), 10 * 60 * 1000); // refresh every 10 min
  }
}
