# Fix the install (run once)

Two issues hit your first `pnpm install`:

1. **`ERR_PNPM_JSON_PARSE` on `acorn-jsx/package.json`** — a download finalized while a metadata file was still empty (pnpm 9.15.2 bug, intermittent on Windows + Defender).
2. **`next@15.1.4` flagged for CVE-2025-66478** — old version. Now bumped to `^15.5.4` in `package.json`.

Run this from PowerShell in the project root to clean up and reinstall:

```powershell
cd C:\Users\jswil\repos\new-dobeu-net

# 1. Update pnpm to the version pinned in package.json (11.1.3)
corepack install -g pnpm@11.1.3
corepack prepare pnpm@11.1.3 --activate

# 2. Nuke the broken install
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force pnpm-lock.yaml -ErrorAction SilentlyContinue

# 3. Clean the pnpm content-addressable store of any half-written entries
pnpm store prune

# 4. Reinstall with the new pinned versions
pnpm install

# 5. Start the dev server
pnpm dev
```

If the install still fails on a JSON parse error for any specific package, run pnpm install once more — that package will re-download cleanly. Windows Defender real-time scanning has been known to interrupt large dependency installs; if it persists, temporarily exclude `node_modules\` from Defender or run the install from an admin shell.

## What changed in package.json

- `next` `15.1.4` → `^15.5.4` (CVE-2025-66478 patched)
- `eslint-config-next` `15.1.4` → `^15.5.4` (matched)
- Removed `@types/mixpanel-browser` (the runtime package ships its own types — the stub was deprecated)
- Added `react-calendly` `^4.3.1` (Calendly inline widget for the booking lightbox)
- `packageManager` pin `pnpm@9.15.2` → `pnpm@11.1.3`

## What changed in the code

- `components/landing/BookingTab.tsx` now embeds Calendly's inline widget pointed at
  `NEXT_PUBLIC_CALENDLY_URL` (your existing free-tier scheduling URL,
  `https://calendly.com/jeremyw-dobeu-r_el`). It fires `booking_scheduled` and mirrors
  the booking to `/api/lead` so Apollo + Supabase + Resend all see it.
- `.env.example` swapped `NEXT_PUBLIC_APOLLO_MEETINGS_URL` for `NEXT_PUBLIC_CALENDLY_URL`.

## Set the Calendly URL in .env.local

Add this line to your `.env.local` (create the file by copying `.env.example`):

```
NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/jeremyw-dobeu-r_el
```

If you want to point at a specific event type (e.g., the 30-minute discovery call only),
log into Calendly, copy that event type's URL (e.g., `https://calendly.com/jeremyw-dobeu-r_el/30min`),
and use that instead.

## Verify after install

```powershell
pnpm type-check              # Zero TS errors expected
pnpm dev                     # http://localhost:3000
```

Open the page, scroll to "Book a call", and the Calendly picker should render inline,
themed to match the active light/dark mode.
