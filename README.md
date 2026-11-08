# Strava Tracktastic

Made by [Casten Riepling](https://www.linkedin.com/in/casten/) w/ help from Claude.

Source: [github.com/casten/strava-tracktastic](https://github.com/casten/strava-tracktastic)

Chrome extension that rewrites lap/interval distances on Strava activity pages into meters, rounded to the nearest 50 m.

- `0.40 km` → `400 m`
- `0.25 mi` → `400 m` (402 m rounded)
- `1.61 km` → `1,600 m`

Only `km` and `mi` values are touched, so pace (`4:30 /km`), speed (`km/h`) and elevation (`m`, `ft`) stay as they are. Distances over 5,000 m (adjustable) are skipped, which keeps the activity total readable.

## Install
1. Unzip this folder.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `strava-tracktastic` folder.
4. Open (or reload) any Strava activity page.

## Settings
Click the extension icon to turn it on/off, change the rounding step (25/50/100 m), or set the maximum distance to convert.

## If something isn't converted
Strava changes its page markup from time to time. The script handles both `0.40 km` in one piece of text and the number and unit split into separate elements (`0.40<abbr>km</abbr>`). If a spot is missed, right-click it → Inspect and check how the number and unit are laid out.
