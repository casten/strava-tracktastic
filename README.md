# Tracktastic for Strava

<img src="icons/icon128.png" alt="" width="64" align="right">

A Chrome extension that makes track workouts on Strava easier to read: lap distances show in meters, rounded to the nearest 50 m, and recovery laps are labeled.

Made by [Casten Riepling](https://www.linkedin.com/in/casten/) w/ help from Claude.

## What it does

On a Strava activity page that looks like a track workout:

- **Distances in meters.** `0.25 mi` → `400 m`, `0.40 km` → `400 m`, `1.00 mi` → `1,600 m`.
- **Pace stays in min/mile.** Pace shown per km is converted to per mile.
- **Recovery laps labeled.** Laps between 9:00 and 12:00 /mi show as *Active recovery*; slower than 12:00 /mi show as *Rest*.
- **Only on track workouts.** It turns on when there are 3+ fast laps at track distances (200, 400, 800, 1600 m…) with recovery laps, or when the title says something like "8x400" or "Track". Steady runs are left alone.

Elevation, speed and the activity total are never changed.

## Install

### Option 1: Download the release (easiest)

1. Go to the [latest release](https://github.com/casten/strava-tracktastic/releases/latest) and download the `.zip` file under **Assets**.
2. Unzip it. You'll get a folder; keep it somewhere permanent (Chrome loads the extension from this folder, so don't delete it).
3. In Chrome, open `chrome://extensions` and turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the unzipped folder.
5. Open any Strava activity. Pin the extension from the puzzle-piece menu to reach its settings easily.

### Option 2: Download the code

On this page, click the green **Code** button → **Download ZIP**, unzip it, and follow steps 3–5 above, choosing the `strava-tracktastic-main` folder.

### Updating

Download the new release, unzip it over your existing folder (or into a new one), then click the reload icon on the extension's card in `chrome://extensions`. If you use a new folder, remove the old extension first.

## Settings

Click the extension's icon:

- **Convert this activity**: turn it on or off for the page you're on, overriding auto-detection. *Use auto-detect* goes back to automatic.
- **Enabled / Auto-detect track workouts**: turn the extension off, or convert every activity regardless of detection.
- **Round to**: 25, 50 or 100 m.
- **Only convert up to**: distances longer than this (default 5,000 m) stay in miles/km.
- **Pace in min/mile**, **Active recovery** range and **Rest** pace.

## Privacy

The extension runs only on `strava.com/activities` pages, changes what's displayed in your browser, and stores only your settings in Chrome. It collects and sends no data. See [PRIVACY.md](PRIVACY.md).

## If something isn't converted

Strava changes its page layout from time to time. If a value is missed, [open an issue](https://github.com/casten/strava-tracktastic/issues) with a screenshot, or right-click the value → **Inspect** and include how the number and unit are laid out.

---

Not affiliated with, endorsed by, or sponsored by Strava, Inc. Strava is a trademark of Strava, Inc.
