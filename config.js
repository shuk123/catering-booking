// Paste the Web App URL you get from deploying google-apps-script/Code.gs
// (Deploy > New deployment > Web app, in the Apps Script editor).
// It looks like: https://script.google.com/macros/s/XXXXXXXXXXXX/exec
const API_URL = "https://script.google.com/macros/s/AKfycbx4dOEUcrNw0w_p5i7zYuS_r4GfX17nbi48R0tJjLXXckH8qYvmtqCUFPhUh9IHIzHVGg/exec";

// OAuth Client ID from Google Cloud Console (APIs & Services > Credentials >
// Create Credentials > OAuth client ID > Web application). Add the URL you
// serve this app from (e.g. http://localhost:5173) under "Authorized
// JavaScript origins" for that client.
const GOOGLE_CLIENT_ID = "674405153349-hbk3btuh2bfgq7jj0ov1pt001uunj2gs.apps.googleusercontent.com";

// Only controls whether the "Admin" nav link/page is shown in the UI — the
// real enforcement is the matching ADMIN_EMAILS constant in Code.gs, so
// changing this alone does not grant or revoke admin access.
const ADMIN_EMAILS = ["ibundacatering@gmail.com", "shukorabdullah95.sa@gmail.com", "noorjannah0711@gmail.com"];
