# Personal Library Shelf

A React + TypeScript + Vite catalogue for a personal manga/book collection. It reads a public Google Sheet as CSV when the page loads or when **Refresh data** is pressed. No backend or scheduled job is required.

## Run locally

```bash
npm install
npm run dev
```

## Features

- Warm oak-inspired virtual bookshelf with book spines scaled by recorded height and page count, and a minimum spine width of 36px.
- Series abbreviations on narrow spines (including Attack On Titan → AOT).
- Search and filters for series, volume, chapters, purchase location, and price.
- List view grouped into collapsible series. Click a series heading to reveal its volumes. Sort series by name, total price, total pages, or combined spine thickness.
- Numeric volumes and numeric volume ranges are sorted numerically; named editions/light novels follow regular numbered volumes in their original spreadsheet order. This keeps One Piece Ace light novels after numbered One Piece volumes rather than treating them as volumes 1 and 2.
- Aggregate collection value, weight, page count, and total stacked thickness. Total and per-series stacked thickness are shown in meters to four decimal places; series headings show series-level value, weight, and pages.
- Book details modal (Escape closes it). The source spreadsheet link is not shown in the interface. Book dimensions use thickness, height, and width columns, all in millimeters.
- No external spine-image support; books use stylized, non-photo spines.

## Spreadsheet

The app fetches CSV data from a public Google Sheet. Its URL components are split in `src/App.tsx` to make the direct URL less obvious in a casual source-code glance; this is only obfuscation, not security. The full URL remains visible to anyone inspecting browser network requests, and the spreadsheet remains public. It expects columns corresponding to `series`, `volume`, `thickness`, `height`, `width`, `weight`, `chapters`, `page number`, `price`, and `location of purchase`. All three dimensions are in millimeters. If the CSV export cannot be fetched from a browser, publish the relevant sheet/tab to the web as CSV in Google Sheets.

The aggregate stacked thickness is the sum of the `thickness` column in millimeters, converted to meters for display. No dimension unit conversion is applied. Price totals assume prices are in the same currency; the interface currently labels them with ₪.

## Deploy to GitHub Pages

A GitHub Actions workflow is included at `.github/workflows/deploy.yml`. It builds the app and deploys the `dist` directory whenever you push to `main` or `master` (or when you manually run the workflow).

1. Put the contents of this project in the **root of your GitHub repository** and push to `main` or `master`.
2. In the repository, open **Settings → Pages** and set the build/deployment source to **GitHub Actions**.
3. Open the **Actions** tab and wait for **Deploy to GitHub Pages** to finish. The live URL will be shown in the deployment job/environment.

The Vite config uses `base: './'`, so built asset paths are relative and the project does not need your repository name hard-coded. This workflow assumes the project files (including `package.json` and `vite.config.ts`) are at the repository root, not inside an extra nested folder.
