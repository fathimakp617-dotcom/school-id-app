# SchoolID ഉപയോഗിക്കുന്ന വിധം

## ലോക്കൽ വികസനം

1. `.env.example` പകർത്തി `.env` ഉണ്ടാക്കുക. Admin email-ും കുറഞ്ഞത് 12 അക്ഷരമുള്ള വ്യത്യസ്ത password-ും നൽകുക.
2. `npm install`, തുടർന്ന് `npm run start:local` പ്രവർത്തിപ്പിക്കുക.
3. `http://localhost:5173` തുറന്ന് Admin അക്കൗണ്ട് ഉപയോഗിച്ച് sign in ചെയ്യുക. **User Accounts**-ൽ Parent, Teacher അക്കൗണ്ടുകൾ സൃഷ്ടിക്കുക. Parent അക്കൗണ്ടിന് ഒരു വിദ്യാർത്ഥിയെ ലിങ്ക് ചെയ്യുക.
4. ലോക്കൽ ഡാറ്റ `server-data/`-ൽ സൂക്ഷിക്കുന്നു; ഇത് ബാക്കപ്പ് ചെയ്യുക.

## ലോകത്തെവിടെനിന്നും ഉപയോഗിക്കാൻ

`render.yaml` ഉപയോഗിച്ച് Render-ൽ public web service-ും PostgreSQL database-ും ഒരുമിച്ച് സൃഷ്ടിക്കാം. GitHub repository Render-ുമായി ബന്ധിപ്പിച്ച് Blueprint deploy ചെയ്യുമ്പോൾ Admin email, 12+ അക്ഷര password, random RFID device key എന്നിവ രഹസ്യ values ആയി നൽകുക. തുടർന്ന് ലഭിക്കുന്ന HTTPS വിലാസത്തിൽ login dashboard ലഭിക്കും. `/api/health`-ൽ database നില പരിശോധിക്കുക.

പഴയ `server-data/` വിവരങ്ങൾ ഉണ്ടെങ്കിൽ backup എടുത്ത ശേഷം hosted database-ലേക്ക് `DATABASE_URL` നൽകി `npm run db:import-local` പ്രവർത്തിപ്പിക്കുക. ഇത് വിദ്യാർത്ഥികൾ, homework, attendance, fees, accounts, attachment files എന്നിവ മാറ്റും; പഴയ login sessions മാറ്റില്ല.

## ESP32 RFID

`firmware/esp32_rfid_lcd/schoolid_config.h.example` പകർത്തി `schoolid_config.h` ഉണ്ടാക്കുക. Wi‑Fi വിവരങ്ങൾക്കൊപ്പം hosted URL `https://<host>/api/rfid/scan`, Render-ൽ നൽകിയ അതേ device key, വിശ്വസനീയ CA certificate എന്നിവ ക്രമീകരിക്കുക. സ്വകാര്യ config file പങ്കിടരുത്. ESP32-ന് internet ലഭിച്ചാൽ scan-ുകൾ എവിടെനിന്നും തുറക്കുന്ന Admin live feed-ിലേക്ക് എത്തും.

GPIO 4 buzzer, GPIO 2 നീല Wi‑Fi LED, GPIO 25 പച്ച LED, GPIO 26 ചുവപ്പ് LED. MFRC522: SS 5, SCK 18, MOSI 23, MISO 19, RST 14.

## APK

`.env.android.example` പകർത്തി `.env.android` ഉണ്ടാക്കി public HTTPS API വിലാസം നൽകുക. Signed APK നിർമ്മിക്കാൻ Java/Android build environment-ും release keystore-ും ആവശ്യമാണ്.

## സിസ്റ്റം പരിധികൾ

UPI payment request ഇപ്പോൾ Admin അംഗീകരിക്കുന്ന മാനുവൽ workflow ആണ്; bank payment gateway ഇല്ല. Password reset/deactivation UI കൂടി നിർമ്മിക്കേണ്ടതുണ്ട്. Render അക്കൗണ്ട് ലഭ്യമാണ്, പക്ഷേ ഈ local project-ന് GitHub remote ഇല്ല; repository ബന്ധിപ്പിച്ചാൽ deploy തുടരാം. കൂടുതൽ വിവരങ്ങൾക്ക് [PRODUCTION.md](./PRODUCTION.md) കാണുക.
