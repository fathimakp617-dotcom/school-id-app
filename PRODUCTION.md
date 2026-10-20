# SchoolID production rollout

The project now has authenticated Admin, Staff and Parent accounts, role checks on the API and live socket feed, and a Parent account can access only its linked student. The first production start creates fixed sign-ins for `admin@schoolid.app`, `staff@schoolid.app`, and `parent@schoolid.app`; passwords are entered as private hosting secrets. The fixed Staff account is assigned to class SA1, and the fixed Parent account is linked to student S006 (Anfas). Admin can still create additional Staff and Parent accounts in the dashboard.

## Current release gates

Do not expose this service publicly yet. Authentication is implemented, but deployment, durable database storage, and operational recovery still need to be configured.

The current Render configuration uses free plans at the user's request for a temporary launch. Render's free web service can spin down when idle, and its free Postgres database expires after 30 days. This setup is for a short trial, not uninterrupted attendance monitoring or long-term student records.

Before a public launch:

1. This project is in the private GitHub repository `fathimakp617-dotcom/school-id-app`. Make sure the Render GitHub integration can access that private repository before creating the Blueprint.
2. Provide unique passwords of at least 12 characters for the Admin, Staff and Parent accounts, plus a long random RFID device key, when Render prompts for secrets. Fixed sign-ins are `admin@schoolid.app`, `staff@schoolid.app`, and `parent@schoolid.app`.
3. Back up existing local data, then import it with `DATABASE_URL=<hosted connection> npm run db:import-local` before switching the reader. The importer transfers the JSON records and uploaded attachments from `server-data/`, preserves existing hosted entries, and never imports active login sessions. Set `LEGACY_DATA_DIR` if local records are stored elsewhere.
4. Confirm `/api/health` reports `ok: true`, `database: healthy`, and check the Render logs for errors. The Admin dashboard's live RFID feed requires the reader to reach the public HTTPS service.
5. Set `.env.android` from `.env.android.example` to the deployed HTTPS API origin if building an Android app. Never use a private `192.168.x.x` address in a production APK.
6. Set the ESP32 firmware to `https://<deployed-host>/api/rfid/scan`, add the verified CA certificate and the same device key, then confirm scan delivery from the Admin live feed.
7. Create and securely store an Android release signing key. The final APK also needs a local Java/Android SDK installation. Keep the same signing key for future updates.

Account security currently has no self-service password reset or Admin account deactivation interface. Set initial credentials privately and add account recovery and deactivation workflows before broad distribution.

## Android release configuration

Copy `.env.android.example` to `.env.android` and replace the example URL with the deployed API origin. Then run `npm run android:release`. The build rejects missing, HTTP, localhost, and private-LAN API addresses. Configure Android release signing and install a Java/Android build environment before distributing the resulting APK.

## Hosting notes

The provided Dockerfile and `render.yaml` build the app and serve the API and web app from one globally reachable Render service. The Blueprint creates a PostgreSQL database in Singapore; homework attachments are stored in PostgreSQL as well. The API supports Socket.IO. Configure `CORS_ORIGINS` to include `https://localhost` for the Capacitor app and any separately hosted web origin.

Render can provide managed HTTPS and WebSocket support. Its free web services sleep when idle and do not preserve filesystem writes across restarts; persistent disks require a paid service. See [Render web services](https://render.com/docs/web-services), [persistent disks](https://render.com/docs/disks), and [free service limitations](https://render.com/docs/free).
