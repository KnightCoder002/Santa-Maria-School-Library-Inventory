# School Library

Vite + Tailwind v4 + Motion front end on Vercel, with Google Sheets as the database and Apps Script as the backend.
`legacy/` holds the previous single-file version for reference (not deployed).

See DEPLOY.md for the full step-by-step guide.

## Setup (all free)
1. **Sheet tabs:** `Inventory`, `Checkouts`, `Genres`. Inventory gets a new column K `ISBN` automatically on the first save.
2. **Backend:** paste `backend/Code.gs` into your Apps Script project, set `SHEET_ID`, then Deploy → Web app (Execute as *Me*, access *Anyone*). Copy the `/exec` URL.
3. **Passwords:** the hashes in `Code.gs` match passwords that were shared in chat. Replace them: in Apps Script run `Logger.log(sha('newpassword'))` and paste the result into `HASHES`.
4. **Vercel:** import the repo, add env vars `GAS_URL` (the `/exec` URL) and optionally `GOOGLE_BOOKS_KEY`. Deploy.
5. **Local:** `npm install`, then `npx vercel dev` (runs the `/api` functions too). Plain `npm run dev` has no API.

## Notes
- Each physical copy is its own row and ID. Scanning an ISBN already in the library offers another copy.
- Optional: drop a photo at `public/school.jpg` (about 1600px wide, under 300 KB) and it appears faintly behind the landing page.
- Existing data: nothing is rewritten. Only blank `ContainedWorks`/`ISBN` headers are added; any `Available` value other than `No` counts as available, as in your old app.
- Camera scanning needs HTTPS (Vercel provides it) and camera permission.
- Reports: the first report creates a `Reports` tab in your Sheet. The principal sees them under Reports in the app and can mark them resolved.
- Quotes: add your own in `src/quotes.js`. The card stays hidden while the list is empty.
- Themes (Paper, Night, Bento) and text size live under the Display button. `photos/` holds an unused, unrotated copy of the school photo.
- Offline: books scanned without a connection are kept on the phone and sent automatically when it is back online.
- `LOAN_LIMIT` at the top of `src/main.js` sets the checkout warning (default 3).
