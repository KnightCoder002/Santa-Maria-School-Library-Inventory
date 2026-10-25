# Deploying the School Library (free)

Accounts needed, all free: **Google** (Sheet + Apps Script), **GitHub** (code), **Vercel** (website).
Vercel's free Hobby plan is meant for personal, non-commercial use. A school library is a grey area, so read their terms.

## How the pieces fit
- **GitHub** holds the code. **Vercel** watches the repository and redeploys the site on every `git push`.
- **Apps Script** (the backend) is separate. `git push` does **not** update it. Whenever `backend/Code.gs` changes, paste it into Apps Script and publish a new version (step 3).
- **No secrets are in the code.** The Sheet ID and password hashes live in Apps Script "Script properties", so the repository can never leak them.

## 1. Prepare the Google Sheet (first time only)
1. Make a backup copy first (File > Make a copy).
2. Required tabs and row-1 headers:
   - `Inventory`: BookID, Title, Author, Genre, SubGenre, Available, AgeGroup, Condition, Language, ContainedWorks, ISBN
   - `Checkouts`: CheckoutID, RollNumber, BookID, Title, CheckoutDate, DueDate, Returned
   - `Genres`: Genre, SubGenre (optional)
3. Created automatically on first use: `Reports`, `Lists`, `Log`, `Settings` and `Quotes`. Do not rename them. (`Reports` gets a `Notes` column added.)
4. Copy the **Sheet ID** from the URL: `docs.google.com/spreadsheets/d/`**THIS-PART**`/edit`.

## 2. Secrets: Script properties (do this BEFORE publishing the new backend)
In Apps Script: **Project Settings** (gear icon) > **Script properties** > Add script property. Add all six:

| Property | Value |
|---|---|
| `SHEET_ID` | the Sheet ID from step 1 |
| `SALT` | any long random text (30+ characters). Never change it later or every password stops working |
| `HASH_student` | hash for the student/teacher password |
| `HASH_librarian` | hash for the librarian password |
| `HASH_principal` | hash for the principal password |
| `HASH_admin` | hash for the Owner password (opens only at `https://YOUR-SITE.vercel.app/#owner`) |

**Making the hashes (easiest):** save `SALT` first. In the editor, type the four passwords inside `makeAllHashes()` at the bottom of `Code.gs`, choose `makeAllHashes` in the toolbar, press Run, approve the prompts, then open View > Execution log. It prints four lines such as `HASH_admin = 3f9a...`. Copy the long text after the equals sign into the Script property with the same name as the start of the line. Then delete the passwords from the function. Use 12+ characters for staff and Owner passwords.

**Later you can change any password from the Owner page (Safety), with no hashes at all.**

**Checking your work:** run `checkSetup()` after setting `role` and `pw` at its top. It says whether each property exists, whether the password matches, and, if it does not, which other role's hash it does match (the usual mistake is making the Owner hash under the wrong role).

**Time zone:** Project Settings > Time zone > Asia/Kolkata. Otherwise dates can shift by a day.

## 3. Deploy or update the backend (Apps Script)
1. **Report emails (optional, recommended).** In Project Settings > Script properties add a property named exactly `OWNER_EMAIL` with your address as the value. Every problem report is then emailed to you, one email per report. (A line at the top of `Code.gs` can hold the address instead, but the property survives updates.) Optionally add `SITE_URL` (for example `https://your-site.vercel.app`) so each email includes a link to the Owner page.
   To check it, sign in as Owner > Safety > Report emails > **Send a test email**.
2. Paste the whole file into the editor.
3. **Permissions (do this before publishing).** This version also uses Google Drive (backups), email (report emails) and triggers (weekly backup). In the toolbar choose `authorizeAll`, press Run and approve the permissions. If Google warns that it has not verified the app, click Advanced > Go to (your project) > Allow. The log should then say OK for all three.
4. **First time:** Deploy > New deployment > **Web app**, Execute as **Me**, access **Anyone**. Copy the **Web app URL** (ends in `/exec`).
   **Every later change:** Deploy > Manage deployments > pencil icon > Version: **New version** > Deploy. The URL stays the same.

## 4. Push the code with git
```
npm install              # updates package-lock.json (commit it)
npm test                 # 34 quick checks of the backend and the content
git add .
git commit -m "describe the change"
git push
```
`node_modules`, `dist` and `.env` are git-ignored.

## 5. Connect Vercel (first time only)
1. vercel.com > Add New > Project > import the GitHub repository (Vite is detected automatically).
2. Environment Variables: `GAS_URL` = the Apps Script Web app URL. `GOOGLE_BOOKS_KEY` is optional.
3. Deploy. Each `git push` to `main` deploys automatically.
4. Changing an environment variable needs a redeploy (Deployments > ... > Redeploy).
`vercel.json` already sets security headers and a 30-second limit for the API functions.

## 6. Updating an existing deployment to this version (read the order)
1. **Script properties first** (step 2), if you have not already. The old backend ignores them.
2. Do step 3 in full: set `OWNER_EMAIL`, paste the new `Code.gs`, run `authorizeAll`, publish a **New version**. Everyone is signed out at that moment.
3. Copy the new project files over your repository folder (keep `.git`, `node_modules`, `package-lock.json`, `.env`), run `npm install`, then `git add . && git commit -m "update" && git push`.
4. Hard-refresh the site (Ctrl+Shift+R).
Do not delete your repository folder: it holds the `.git` history.

## 7. Optional: Google Books key
console.cloud.google.com > create a project > enable **Books API** > Credentials > API key, **restricted to the Books API**, with a daily quota set. Free.

## 8. Test checklist
- Sign in as each of the four logins. A wrong password shows an error and the button returns to normal.
- Librarian: Check out and Add books exist. Principal: neither (and no Add books button on the dashboard).
- The two dashboards look different: the librarian's is for the desk, the principal's has charts, collection condition, never-borrowed and more.
- Records: filter by Out now / Overdue / Returned, then Export CSV (opens in Excel) and Print or PDF.
- Student: tick "Keep me signed in", close the browser, open the site again: you land in the library without a password. Sign out forgets the device.
- Student: Save a book, choose a roll number and a 4-digit PIN. On another device the same roll and PIN show the same list.
- Owner (`/#owner`): Overview, Reports (notes, filters), Wanted books, Stats, Activity, Checks, Settings (notice shows on the student home), Safety (change a password, Back up now: a copy appears in Google Drive under "Library backups").
- Send a problem report: it shows under Reports, and an email arrives if you set `OWNER_EMAIL`.
- Turn off Wi-Fi, add a book as librarian, turn it back on: it syncs once, never twice.

## Who can do what
- **Student / Teacher:** browse, search, personal reading list (roll number + PIN), report a problem. Can stay signed in on their own device for 30 days.
- **Librarian:** check out, return, add and edit books, records (with export), reset a student's list PIN.
- **Principal / Director:** records and exports, edit and remove books, genres, the Stats page and a data-rich dashboard. No check out and no adding books.
- **Owner:** reports with private notes, wanted books, stats, activity log, data checks, settings (notice, loan rules, quotes), change passwords, sign everyone out, backups.

## Good to know
- Data is cached for up to two minutes on the server and 45 seconds on each device. The Refresh button loads the latest at once.
- "Keep me signed in" is for students only, uses a signed token valid for 30 days that renews each visit, and ends with Sign out or the Owner's "Sign everyone out". Staff are never remembered.
- Reading lists: the first person to use a roll number chooses its PIN (the librarian can reset it). After 5 wrong PINs a roll number is locked for 10 minutes.
- Wrong staff passwords never lock the real librarian out; guessing is only slowed. The Owner login locks for 30 minutes after 5 wrong tries.
- Backups are copies of the Sheet in Drive (the newest 12 are kept). Passwords are not in the Sheet, so a backup never contains them.

## Troubleshooting
- **"The server is not set up yet":** `SHEET_ID` or `SALT` is missing in Script properties.
- **"This login is not set up yet: HASH_admin is missing":** the property is missing or misspelled (exactly `HASH_student`, `HASH_librarian`, `HASH_principal`, `HASH_admin`).
- **"The saved password hash ... looks wrong":** copy it again from the Execution log.
- **Every password says "Incorrect":** the hash was made with a different `SALT` or role. Run `checkSetup()`.
- **"Google Drive permission is missing" (or Google's own "You do not have permission to call DriveApp..."):** the web app has not been given Drive access yet. In the Apps Script editor: (1) choose `authorizeAll` in the toolbar and press Run; if Google says "hasn't verified this app", click Advanced > Go to (your project) > Allow; (2) read the log: each line should say OK; (3) **then** Deploy > Manage deployments > pencil icon > Version: **New version** > Deploy. The order matters: the permission must be granted before the new version is made. Still failing? Project Settings > tick "Show appsscript.json manifest file in editor"; if that file has an `oauthScopes` list, delete the whole list so Google detects the scopes itself.
- **Report emails do not arrive:** (1) Owner > Safety > Report emails shows which address is used (partly hidden); if it says no address, the Script property is missing or misspelled (it must be exactly `OWNER_EMAIL`). (2) Press **Send a test email**: a message about permission means you need `authorizeAll` and a New version (see above). (3) Look in Owner > Activity for "Report email failed": it states the reason. (4) Check your spam folder. Google allows about 100 emails a day.
- **"Backend unreachable" or invalid response:** `GAS_URL` is wrong, or the deployment's access is not "Anyone".
- **A new feature says "Not allowed":** `Code.gs` was not republished as a new version.
- **Camera does not open:** allow camera permission. It works only over HTTPS.
- **Run locally:** `npx vercel dev` (plain `npm run dev` has no API).
