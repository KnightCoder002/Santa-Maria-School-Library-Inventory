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
3. Created automatically on first use: `Reports` and `Lists`. Do not rename them.
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

**Making a hash:** save `SALT` first. In the editor, change the role and password inside `makeHash()` at the bottom of `Code.gs` (for example `pwHash('librarian', 'my long passphrase')`), choose `makeHash` in the toolbar, press Run, approve the prompts, open View > Execution log, and copy the long text into the matching `HASH_` property. Repeat for all four logins. Use 12+ characters for staff and Owner passwords. Do not leave real passwords in the function afterwards. To check your work at any time, run `checkSetup()` the same way: it says whether each property exists and whether a password matches its hash.

**Time zone:** Project Settings > Time zone > Asia/Kolkata. Otherwise dates can shift by a day.

## 3. Deploy or update the backend (Apps Script)
**First time:** paste `backend/Code.gs` into the editor (nothing in it needs editing). Deploy > New deployment > **Web app**, Execute as **Me**, access **Anyone**. Approve permissions and copy the **Web app URL** (ends in `/exec`).

**Every later change:** paste the new file in, then Deploy > Manage deployments > pencil icon > Version: **New version** > Deploy. The URL stays the same.

## 4. Push the code with git
```
npm install              # updates package-lock.json (commit it)
git add .
git commit -m "describe the change"
git push
```
`node_modules`, `dist` and `.env` are git-ignored. Run `npm test` before pushing: it runs 17 checks on the backend and the content in a few seconds.

The backend changed again in this version (reading lists now save one book at a time), so publish a **New version** in Apps Script as in step 3.

## 5. Connect Vercel (first time only)
1. vercel.com > Add New > Project > import the GitHub repository (Vite is detected automatically).
2. Environment Variables: `GAS_URL` = the Apps Script Web app URL. `GOOGLE_BOOKS_KEY` is optional.
3. Deploy. Each `git push` to `main` deploys automatically.
4. Changing an environment variable needs a redeploy (Deployments > ... > Redeploy).
`vercel.json` already sets security headers and a 30-second limit for the API functions.

## 6. Updating an existing deployment to this version (read the order)
1. **Script properties first** (step 2). The old backend ignores them, so nothing breaks yet.
2. Paste the new `Code.gs` into Apps Script and publish a **New version** (step 3). From this moment everyone is signed out and must use the new passwords.
3. Copy the new project files over your repository folder (keep `.git`, `node_modules`, `package-lock.json`, `.env`), run `npm install`, then `git add . && git commit -m "update" && git push`.
4. Hard-refresh the site (Ctrl+Shift+R).
Do not delete your repository folder: it holds the `.git` history.

## 7. Optional: Google Books key
console.cloud.google.com > create a project > enable **Books API** > Credentials > API key, **restricted to the Books API**, with a daily quota set. Free.

## 8. Test checklist
- Sign in as each of the four logins. A wrong password shows an error.
- Principal has no Check out. Librarian does.
- Owner: open `/#owner`, sign in, see only Reports. No Owner link on the normal sign-in page.
- Student: Save a book, choose a roll number and a 4-digit PIN. On another device the same roll and PIN show the same list.
- Librarian: add a book (the form clears at once and "Saving 1..." shows briefly), edit it, check it out, return it. Check the Sheet.
- Turn off Wi-Fi, add a book, turn it back on: the book syncs once, never twice.
- Display button: Paper, Night, Bento.

## Who can do what
- **Student / Teacher:** browse, search, personal reading list (roll number + PIN), report a problem.
- **Librarian:** check out, return, add and edit books, records, reset a student's list PIN.
- **Principal / Director:** everything the librarian can, except check out; also removes books, analytics, genres.
- **Owner (admin):** reads and resolves problem reports. Nothing else.

## Good to know
- Data is cached for up to two minutes on the server and 45 seconds on each device. The librarian's Refresh button loads the latest at once.
- Reading lists: the first person to use a roll number chooses its PIN (the librarian can reset it). After 5 wrong PINs a roll number is locked for 10 minutes.
- Wrong staff passwords never lock the real librarian out; repeated guesses are only slowed down. The Owner login does lock for 30 minutes after 5 wrong tries.

## Troubleshooting
- **"The server is not set up yet":** `SHEET_ID` or `SALT` is missing in Script properties.
- **"This login is not set up yet: HASH_admin is missing":** the Script property is missing or its name is misspelled (it must be exactly `HASH_student`, `HASH_librarian`, `HASH_principal` or `HASH_admin`).
- **"The saved password hash ... looks wrong":** the value has missing or extra characters. Copy it again from the Execution log.
- **Every password says "Incorrect":** the `HASH_` value was made with a different `SALT` or role. Make it again.
- **"Backend unreachable" or invalid response:** `GAS_URL` is wrong, or the deployment's access is not "Anyone".
- **A new feature says "Not allowed":** `Code.gs` was not republished as a new version.
- **Camera does not open:** allow camera permission. It works only over HTTPS.
- **Run locally:** `npx vercel dev` (plain `npm run dev` has no API).
