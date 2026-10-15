# Deploy Vestly

The release is a static website. It needs no application server, database, shared API key, or environment secrets. Visitors connect their own Gemini keys in the browser.

## Local release check

Install Node.js 24 LTS, then run in PowerShell:

```powershell
Set-Location -LiteralPath 'E:\Aifaz Workspace\investment schedule web app'
npm.cmd ci
npm.cmd run check
npm.cmd run preview
```

Open http://127.0.0.1:5174. The preview serves only the generated `dist` folder. `npm.cmd start` uses port 5173 instead. Stop the preview with Ctrl+C. After editing source files, rebuild before testing the preview.

## GitHub preparation

This folder is intended to become its own repository, separate from the personal workspace. Do not initialize or push the workspace root as this app's repository.

The tracked source should include HTML, JavaScript, CSS, scripts, tests, package manifests, `.gitignore`, `.gitattributes`, the icon, headers, and workflows. The lockfile pins the build dependencies. `.gitignore` excludes generated output, dependencies, screenshots, sheet backups, environment files and the old unused command prototype. Review the staged file list before the future push. No personal sheet or API key belongs in the repository.

Pushing code triggers **Check app**, which installs locked dependencies, tests, builds, checks release contents, and audits dependencies. It does not publish a website.

## GitHub Pages, after the repository is pushed

1. In the repository, open **Settings → Pages**.
2. Set the publishing **Source** to **GitHub Actions**.
3. Open **Actions → Deploy to GitHub Pages → Run workflow**. Select the default branch.
4. Wait for both build and deployment jobs to finish. Open the URL reported by the deployment.

Deployment is manual. New pushes check the code but do not automatically publish it. GitHub Pages publishes only the uploaded `dist` artifact. Relative asset links support project sites such as `https://username.github.io/repository/`.

## Other static hosts

### Vercel

Import `aifazkarediya/vestly` from GitHub and keep the repository root as the root directory. The checked-in `vercel.json` selects Other as the framework, installs with `npm ci`, runs the full `npm run check`, and publishes only `dist`. It also configures security headers because Vercel does not use the `_headers` file. No environment variables or shared Gemini API key are required. Visitors connect their own keys in the published app. Future pushes to the production branch will deploy through the Vercel Git integration.

### General setup

Use `npm ci && npm run check` as the build command and `dist` as the publish directory. Deploy only `dist`, never the whole project folder. Use HTTPS for the public site. `_headers` supplies additional security headers on hosts that support that file, such as Cloudflare Pages and Netlify. GitHub Pages does not apply custom `_headers`; the app's HTML content-security policy still blocks external scripts and limits API connections to Google, but host-level framing restrictions need host support.

## Before the first public release

- Live AI edits and Undo passed in the local production preview, including a combined 12-row update. Repeat a small live edit after publication because domain restrictions, model access and quota can differ. Some provider requests temporarily failed during testing. Automated simulated tests do not verify live service availability.
- Confirm the public domain is allowed by any website restrictions on your Gemini key. Each visitor's Google account controls their own usage and billing.
- Review `privacy.html`. Sheet inputs go directly to Google only when the visitor presses Run. The host may log ordinary page requests. Refresh clears the in-memory API key.
- Verify export and your intended mobile browser. A CSV is an export, not a restorable app backup; CSV import is not implemented.

Official workflow guidance: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
