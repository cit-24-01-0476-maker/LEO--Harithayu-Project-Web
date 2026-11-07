# Google donation integration

Prepared only: no Google account resources have been created or changed yet.

Target form: https://docs.google.com/forms/d/1ZP8nLGEvPMhZgOAuKD90vdiQtBLCEKiJTVGBDMkInBk/edit

Account-owner authorization is required. Paste Code.gs into a standalone Apps Script project. Inspect the existing form before running setupHarithayu: unrelated required questions, particularly native upload questions, may block website responses. Setup preserves existing questions, adds missing text fields, links a response Sheet if needed, and creates a private Drive folder plus Website donation review tab.

Run setupHarithayu after reviewing field mapping and approving Forms, Sheets and Drive scopes. Resource URLs are logged without secrets. BRIDGE_SECRET is generated in Script Properties; copy it privately into Vercel GOOGLE_BRIDGE_SECRET, never into chat or browser code. Deploy the script as an owner-executed web app accepting HTTP requests; every request is authenticated by the server-only secret. Set its /exec URL as GOOGLE_BRIDGE_URL and redeploy Vercel. Owner authorization is required for this deployment. Keep the Sheet, editor and Drive folder private.

The website submits a genuine Google Form response using text fields. The private slip is stored in Drive and its URL is recorded; it is not submitted as a native Form file-upload answer. Google Forms native file uploads require a Google login. Review status is updated in the review tab; the original response remains an immutable submission record. Duplicate IDs are deduplicated. Admin Sync to Google retries failed syncs. Formula-like text is escaped before writing the Sheet. Quotas/storage limits apply.

Before opening donations, test a submission, inspect its form response, Sheet row and private Drive file, retry the same ID, and confirm/reject in website admin. Verify that private links are not publicly accessible. Export the Google Sheet as Microsoft Excel through File > Download when needed. The existing persistent database and bank/admin configuration remain required; Google mirroring does not replace payment verification. Demo submissions never sync to Google.
