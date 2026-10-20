# SchoolID production rollout

The project now has authenticated Admin, Teacher and Parent accounts, role checks on the API and live socket feed, and a Parent account can access only its linked student. Admin creates Teacher and Parent accounts from the dashboard. Hosted records and homework attachments use PostgreSQL. The web app and API share one HTTPS origin, and a Docker image can be built for a hosted Node service.

## Current release gates

Do not expose this service publicly yet. Authentication is implemented, but deployment, durable database storage, and operational recovery still need to be configured.

Before a public launch:

1. Connect this project to a GitHub repository and attach that repository to Render. Render is connected, but this local project folder has no Git remote yet, so the live service cannot be created from it yet.
2. Select paid plans for the web service and PostgreSQL, then provide an Admin email, unique 12+ character password and a long random RFID device key when Render prompts for secrets.
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
