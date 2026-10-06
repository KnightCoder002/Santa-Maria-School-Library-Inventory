# Deploying the School Library (free)

Accounts needed, all free: **Google** (Sheet + Apps Script), **GitHub** (code), **Vercel** (website).
Vercel's free Hobby plan is meant for personal, non-commercial use. A school library is a grey area, so read their terms.

## How the pieces fit
- **GitHub** holds the code. **Vercel** watches the repository and redeploys the site on every `git push`.
- **Apps Script** (the backend) is separate. It is **not** updated by `git push`. Whenever `backend/Code.gs` changes, paste it into Apps Script and publish a new version (step 3).

## 1. Prepare the Google Sheet (first time only)
1. Make a backup copy first (File > Make a copy).
2. Required tabs and row-1 headers:
   - `Inventory`: BookID, Title, Author, Genre, SubGenre, Available, AgeGroup, Condition, Language, ContainedWorks, ISBN
   - `Checkouts`: CheckoutID, RollNumber, BookID, Title, CheckoutDate, DueDate, Returned
   - `Genres`: Genre, SubGenre
3. Created automatically on first use: `Reports` (problem reports) and `Lists` (students' reading lists). Do not rename them.
4. Copy the **Sheet ID** from the URL: `docs.google.com/spreadsheets/d/`**THIS-PART**`/edit`.

## 2. Passwords (four logins)
Student, librarian, principal and **admin**. Admin is the Owner login, a small "Owner" link on the sign-in page. It only reads problem reports.
1. In Apps Script, edit the text inside `makeHash()` at the bottom of `Code.gs`, choose `makeHash` in the toolbar, press Run, approve the prompts, then copy the long hash from View > Execution log.
2. Paste it into `HASHES` for that role. Repeat for all four. Until `admin` is set, nobody can sign in as Owner.

## 3. Deploy or update the backend (Apps Script)
**First time:** Extensions > Apps Script from your Sheet. Paste in `backend/Code.gs`, set `SHEET_ID`, set the four hashes. Deploy > New deployment > **Web app**, Execute as **Me**, access **Anyone**. Approve permissions and copy the **Web app URL** (ends in `/exec`).

**Every later change to `Code.gs`:** paste the new file in (keep your `SHEET_ID` and hashes), then Deploy > Manage deployments > pencil icon > Version: **New version** > Deploy. The URL stays the same.

## 4. Push the code with git
First time:
```
cd library
npm install              # creates package-lock.json (commit it)
git init
git add .
git commit -m "School library"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/school-library.git
git push -u origin main
```
After that, every change is just:
```
git add .
git commit -m "describe the change"
git push
```
`node_modules`, `dist` and `.env` are git-ignored. Never commit passwords or hashes you want private: keep a private repository, because `Code.gs` contains the password hashes.

## 5. Connect Vercel (first time only)
1. vercel.com > Add New > Project > import the GitHub repository (Vite is detected automatically).
2. Environment Variables: `GAS_URL` = the Apps Script Web app URL. `GOOGLE_BOOKS_KEY` is optional.
3. Deploy. From now on each `git push` to `main` deploys automatically. Pushes to other branches get preview links.
4. Changing an environment variable needs a redeploy (Deployments > ... > Redeploy).

## 6. Applying this update to your existing deployment
1. Replace the project files with the new ones, then `git add . && git commit -m "Owner login, PIN lists, filters" && git push`. Vercel redeploys.
2. Paste the new `backend/Code.gs` into Apps Script (keep your `SHEET_ID` and existing hashes), add an `admin` hash (step 2), then publish a **New version** (step 3).
3. Hard-refresh the site (Ctrl+Shift+R) and check the list below.

## 7. Optional: Google Books key
console.cloud.google.com > create a project > enable **Books API** > Credentials > API key, restricted to the Books API. Free.

## 8. Test checklist
- Sign in as each of the four logins. A wrong password shows an error.
- Principal has no Check out. Librarian does.
- Owner sees only Reports. Send a report as a student and confirm it appears.
- Student: tap Save on a book, choose a roll number and a 4-digit PIN. Open the site on another device, enter the same roll and PIN, and the same list appears. A wrong PIN is refused.
- Librarian dashboard: Reset PIN for that roll. The student can choose a new PIN and still has their books.
- On a phone (HTTPS): Add > scan a barcode > save. Check the new row in the Sheet.
- Check a book out and return it. Watch `Available` in the Inventory tab.
- Display button: Paper, Night, Bento.

## Who can do what
- **Student / Teacher:** browse, search, personal reading list (roll number + PIN), report a problem.
- **Librarian:** check out, return, add and edit books, records, reset a student's list PIN.
- **Principal / Director:** everything the librarian can, except check out; also removes books, analytics, genres.
- **Owner (admin):** reads and resolves problem reports. Nothing else.

## Reading lists: what to know
- The first person to use a roll number chooses its PIN. If a classmate claims it first, the librarian resets it.
- After 5 wrong PINs a roll number is locked for 10 minutes.
- PINs are stored as hashes, never as the PIN itself. Lists are in the `Lists` tab of your Sheet.

## Troubleshooting
- **"Backend unreachable" or invalid response:** `GAS_URL` is wrong, or the deployment's access is not "Anyone".
- **A new feature does nothing or says "Not allowed":** `Code.gs` was not republished as a new version (step 3).
- **"Session expired":** sign in again. Sessions last 4 hours.
- **Camera does not open:** allow camera permission. It works only over HTTPS.
- **Book not found after scanning:** normal for some Tamil, Hindi and local books. Use title lookup or type it in.
- **Run locally:** `npx vercel dev` (plain `npm run dev` has no API).
