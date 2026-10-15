# Vestly

Vestly is a browser-based USD investment schedule with editable spreadsheet rows and optional Gemini AI editing. No login or shared database is required.

## Run locally

Requires Node.js 22 or later; Node.js 24 is used by the automated checks.

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run preview
```

Open http://127.0.0.1:5174. The production build is in `dist/`. Rebuild after source edits. `npm.cmd start` serves the same build on port 5173. The PowerShell helper `start.ps1` installs missing dependencies, builds, and starts port 5173.

## Use the sheet

Edit initial capital, monthly deposits, return rates and withdrawals. Add rows, change months, export CSV, or use Undo. New browsers start with a sample schedule; their saved changes stay in that browser. The app name can change without losing existing local sheets because the storage identifier is retained.

To use AI, click **Connect AI**, open **Get a Gemini API key from Google**, paste your own key, and click **Connect**. Describe your changes and press **Run**. Review the result; Undo restores the previous sheet.

## Privacy

- Each visitor has separate browser localStorage. There is no owner-side database or account system.
- The key is held in tab memory only. Refresh or Disconnect clears it; it is never saved alongside the sheet or placed in URLs or exports.
- Connecting checks model access directly with Google, without sheet data. Running AI sends the instruction and complete sheet inputs directly to Google, under that visitor's account terms, quota and billing.
- Styles, fonts, icons and scripts are served locally from the same website. The app loads no third-party executable scripts or analytics. The host can still log ordinary page requests. Browser extensions and the device remain part of the trust boundary.
- Clearing browser data can remove a saved sheet. Changing the domain or browser creates separate storage. CSV export provides an independent copy; import is not implemented.

See [the visitor privacy page](privacy.html).

## Calculations

Deposits are added before each month's return; withdrawals follow the return. Ending balances roll into the next row unless explicitly overridden. Rates are monthly. Net ROI is simple net profit divided by contributed capital, not an annualized or time-weighted return. Calculations retain numeric precision internally; displayed amounts and CSV exports use consistent cent rounding.

## Checks and deployment

`npm.cmd run check` runs automated API-boundary and CSV tests, checks source restrictions, builds static assets, and verifies release files and local links. `npm.cmd audit --audit-level=moderate` checks build dependencies. Only allowlisted app files, generated assets and dependency licenses enter `dist`; local screenshots and sheet backups are excluded.

GitHub workflows check pushes and pull requests. Deployment to GitHub Pages is a separate manual workflow. See [DEPLOYMENT.md](DEPLOYMENT.md). Website publication is a separate step from pushing the repository.

Live Gemini editing was verified with both a single return-rate edit and a combined deposit, return and quarterly-withdrawal instruction across 12 rows. Calculations and Undo passed. Some requests received temporary provider errors before a later successful retry. Automated tests separately use simulated Google responses to cover invalid output, quotas, authentication failures, disconnection and safe request construction. AI output is validated before replacing the sheet; executable model output is never run.

## Origin

Adapted from the supplied `vestsheet_usd_blue_theme.html`. The original Downloads file is unchanged. `commands.js` is an ignored, unused early prototype and is not part of the release. Internal legacy storage and module identifiers remain for compatibility.
