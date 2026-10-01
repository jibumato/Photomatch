// Daily forecast from Open-Meteo, shared by the booking calendar and the
// photographer shift grid.

// Returns one { code, pop } (weather code, max precipitation probability) per
// entry of `days`, aligned by index, or null if the request fails.
//
// Open-Meteo decides the window (forecast_days) instead of us sending explicit
// start/end dates computed from the visitor's clock: its allowed range is
// judged on its side, so a client-computed end date can land one day past it
// (e.g. JST mornings, when Japan is already on the next UTC date) and the
// whole request is rejected. Days are matched by date string; days beyond
// the forecast simply get no icon.
export async function loadDailyWeather(area, days) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${area.lat}&longitude=${area.lon}&daily=weather_code,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=16`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('weather fetch failed', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    const daily = data.daily || {};
    const dates = daily.time || [];
    const codes = daily.weather_code || daily.weathercode || [];
    const pops = daily.precipitation_probability_max || [];
    const byDate = {};
    dates.forEach((iso, i) => { byDate[iso] = { code: codes[i], pop: pops[i] }; });
    return days.map((d) => byDate[d.iso] || null);
  } catch (err) {
    console.warn('weather fetch failed', err);
    return null;
  }
}
