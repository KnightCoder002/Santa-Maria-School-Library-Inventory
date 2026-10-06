# Deploying the School Library (free)

You need three free accounts: **Google** (Sheet + Apps Script), **GitHub** (code), **Vercel** (website).
Vercel's free Hobby plan is meant for personal, non-commercial use. A school library is a grey area, so read their terms. The site would still run on their paid plan if ever required, and nothing else here costs money.

## 1. Prepare the Google Sheet
1. Make a copy of your existing Sheet first (File > Make a copy) as a backup.
2. It must have three tabs with these exact names and header rows (row 1):
   - `Inventory`: BookID, Title, Author, Genre, SubGenre, Available, AgeGroup, Condition, Language, ContainedWorks, ISBN
   - `Checkouts`: CheckoutID, RollNumber, BookID, Title, CheckoutDate, DueDate, Returned
   - `Genres`: Genre, SubGenre
3. Your existing data stays as it is. If `ContainedWorks` or `ISBN` headers are missing, the app adds them on the first book you save.
4. Copy the **Sheet ID** from the URL: `docs.google.com/spreadsheets/d/`**THIS-PART**`/edit`.

## 2. Deploy the backend (Apps Script)
1. In the Sheet: Extensions > Apps Script. Delete the old code and paste in `backend/Code.gs`.
2. Set `SHEET_ID` at the top to your Sheet ID.
3. **Change the passwords.** Edit the text inside `makeHash()` at the bottom, choose `makeHash` in the toolbar, press Run, approve the permission prompts, then open View > Execution log and copy the long hash. Paste it into `HASHES` for that role. Repeat for each of the three roles.
4. Deploy > New deployment > type **Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy, approve permissions, and copy the **Web app URL** (ends in `/exec`).
5. Later code changes: Deploy > Manage deployments > pencil icon > Version: New version > Deploy. The URL stays the same.

## 3. Put the code on GitHub
```
unzip school-library.zip
cd library
npm install            # creates package-lock.json
git init
git add .
git commit -m "School library"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/school-library.git
git push -u origin main
```
Create the empty repository on github.com first (private is fine).

## 4. Deploy the website (Vercel)
1. vercel.com > Add New > Project > import the GitHub repository. The Vite settings are detected automatically.
2. Before deploying, open **Environment Variables** and add:
   - `GAS_URL` = the Apps Script Web app URL from step 2
   - `GOOGLE_BOOKS_KEY` = optional (see below)
3. Click Deploy. Your site is live at `something.vercel.app`.
4. Changing an environment variable later needs a redeploy (Deployments > ... > Redeploy).

## 5. Optional: Google Books key (more reliable lookups)
console.cloud.google.com > create a project > APIs & Services > enable **Books API** > Credentials > Create API key > restrict it to the Books API. It is free.

## 6. Test checklist
- Sign in as each role. A wrong password shows an error.
- On your phone (HTTPS), Add > Scan a barcode > save. Check the new row in the Sheet.
- Check a book out, then return it. Look at the Inventory `Available` column.
- Send a report. A `Reports` tab appears in the Sheet and the report shows under Reports for the principal.
- Display button: try Paper, Night and Bento.

## 7. Updating later
Change the code, then `git add . && git commit -m "change" && git push`. Vercel redeploys automatically. Changes to `backend/Code.gs` need step 2.5.

## Troubleshooting
- **"Backend unreachable" or invalid response:** `GAS_URL` is wrong, or the deployment's access is not "Anyone".
- **"Session expired":** sign in again. Sessions last 4 hours.
- **Camera does not open:** allow camera permission for the site. It works only over HTTPS.
- **Book not found after scanning:** normal for some Tamil, Hindi and local books. Use title lookup or type it in.
- **Run locally:** `npx vercel dev` (plain `npm run dev` has no API).
