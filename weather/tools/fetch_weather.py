#!/usr/bin/env python3
"""Fetch today's real forecast from Open-Meteo for a place.
usage: fetch_weather.py LAT LON OUT.json
Exits non-zero (and writes nothing) if the forecast can't be fetched:
the daily videos must never be made from invented numbers."""
import sys, json, time, urllib.request, urllib.parse
lat, lon, out = sys.argv[1], sys.argv[2], sys.argv[3]
q = urllib.parse.urlencode({
    'latitude': lat, 'longitude': lon, 'timezone': 'Europe/London', 'wind_speed_unit': 'mph', 'forecast_days': 7,
    'current': 'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,pressure_msl,cloud_cover',
    'hourly': 'temperature_2m,precipitation_probability,weather_code,is_day',
    'daily': 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max',
})
last = None
for attempt in range(4):
    try:
        with urllib.request.urlopen('https://api.open-meteo.com/v1/forecast?' + q, timeout=30) as r:
            data = json.load(r)
        if data.get('error'):
            raise RuntimeError(data.get('reason'))
        if not data.get('daily', {}).get('time'):
            raise RuntimeError('no daily forecast in response')
        json.dump(data, open(out, 'w'))
        print('ok', data['daily']['time'][0], data['daily']['temperature_2m_max'][0], data['daily']['temperature_2m_min'][0])
        sys.exit(0)
    except Exception as e:
        last = e
        time.sleep(5 * (attempt + 1))
print(f'FAILED to fetch weather: {last}', file=sys.stderr)
sys.exit(2)
