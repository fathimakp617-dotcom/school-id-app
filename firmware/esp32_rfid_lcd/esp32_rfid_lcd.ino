/* SchoolID ESP32 RFID reader (display optional; default is display-free).
 * MFRC522: SS=5, SCK=18, MOSI=23, MISO=19, RST=14, 3V3/GND.
 * Active buzzer=GPIO4; onboard blue LED=GPIO2; green=GPIO25; red=GPIO26.
 * Use a resistor in series with each external LED.
 */
#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include "schoolid_config.h"

// Configure these for the Wi-Fi network shared by the ESP32 and the server.
const char* WIFI_SSID = SCHOOLID_WIFI_SSID;
const char* WIFI_PASSWORD = SCHOOLID_WIFI_PASSWORD;
const char* SCAN_URL = SCHOOLID_SCAN_URL;

#ifndef SCHOOLID_RFID_DEVICE_KEY
#define SCHOOLID_RFID_DEVICE_KEY ""
#endif

#ifndef SCHOOLID_CA_CERT
#define SCHOOLID_CA_CERT ""
#endif

constexpr uint8_t RFID_SS_PIN = 5;
constexpr uint8_t RFID_RST_PIN = 14;
constexpr uint8_t BUZZER_PIN = 4;
constexpr uint8_t WIFI_LED_PIN = 2;
constexpr uint8_t GREEN_LED_PIN = 25;
constexpr uint8_t RED_LED_PIN = 26;
constexpr bool LED_ACTIVE_HIGH = true;
constexpr uint8_t MAX_LOCAL_SCANS = 20;

MFRC522 reader(RFID_SS_PIN, RFID_RST_PIN);
WebServer dashboard(80);
unsigned long lastScanAt = 0;
constexpr unsigned long SCAN_COOLDOWN_MS = 1200;

struct ScanRecord {
  String uid;
  String state;
  String detail;
  unsigned long scannedAt;
  int httpCode;
};

ScanRecord scanHistory[MAX_LOCAL_SCANS];
uint8_t scanCount = 0;
String apiState = "Waiting for first scan";

void setLed(uint8_t pin, bool on) {
  digitalWrite(pin, (on == LED_ACTIVE_HIGH) ? HIGH : LOW);
}

void beep(uint8_t count, uint16_t durationMs = 100, uint16_t gapMs = 100) {
  for (uint8_t i = 0; i < count; ++i) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(durationMs);
    digitalWrite(BUZZER_PIN, LOW);
    if (i + 1 < count) delay(gapMs);
  }
}

void showStatus(const String& status) {
  // Serial output is the status display when no screen is connected.
  Serial.println("[STATUS] " + status);
}

String readUid() {
  String uid;
  for (byte i = 0; i < reader.uid.size; ++i) {
    if (reader.uid.uidByte[i] < 0x10) uid += '0';
    uid += String(reader.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

String jsonStringField(const String& json, const char* key) {
  const String marker = String("\"") + key + "\":\"";
  int start = json.indexOf(marker);
  if (start < 0) return "";
  start += marker.length();
  int end = json.indexOf('"', start);
  if (end < 0) return "";
  String value = json.substring(start, end);
  value.replace("\\\"", "\"");
  value.replace("\\\\", "\\");
  return value;
}

String jsonEscape(const String& value) {
  String escaped;
  escaped.reserve(value.length() + 8);
  for (size_t i = 0; i < value.length(); ++i) {
    const char c = value[i];
    if (c == '"' || c == '\\') escaped += '\\';
    if (c == '\n') escaped += "\\n";
    else if (c == '\r') escaped += "\\r";
    else escaped += c;
  }
  return escaped;
}

void addLocalScan(const String& uid) {
  if (scanCount < MAX_LOCAL_SCANS) ++scanCount;
  for (int i = scanCount - 1; i > 0; --i) scanHistory[i] = scanHistory[i - 1];
  scanHistory[0] = {uid, "Sending", "Waiting for server", millis(), 0};
}

void updateLatestScan(const String& state, const String& detail, int httpCode) {
  if (scanCount == 0) return;
  scanHistory[0].state = state;
  scanHistory[0].detail = detail;
  scanHistory[0].httpCode = httpCode;
}

const char DASHBOARD_HTML[] PROGMEM = R"HTML(
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101827"><title>SchoolID RFID Reader</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b1220;color:#e7eefb}*{box-sizing:border-box}body{margin:0;padding:22px;max-width:850px;margin-inline:auto}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}h1{font-size:24px;margin:0 0 5px}.muted{color:#9aabc4;font-size:14px}.pill{border:1px solid #334155;border-radius:999px;padding:7px 12px;font-size:13px}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:22px 0}.card,.scan{background:#141f31;border:1px solid #26364d;border-radius:14px;padding:16px}.label{color:#9aabc4;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.value{font-size:18px;font-weight:650;margin-top:5px;overflow-wrap:anywhere}.section{display:flex;justify-content:space-between;align-items:center;margin:24px 0 12px}h2{font-size:18px;margin:0}.list{display:grid;gap:10px}.scan{display:grid;grid-template-columns:1fr auto;gap:8px 12px;align-items:center}.uid{font-family:ui-monospace,monospace;font-size:18px;font-weight:700;letter-spacing:.06em}.detail{color:#9aabc4;font-size:13px;margin-top:4px;overflow-wrap:anywhere}.badge{border-radius:999px;padding:6px 10px;font-size:12px;background:#334155}.ok{background:#064e3b;color:#a7f3d0}.bad{background:#7f1d1d;color:#fecaca}.pending{background:#713f12;color:#fde68a}.empty{padding:28px;text-align:center;color:#9aabc4;background:#141f31;border-radius:14px}@media(max-width:520px){body{padding:16px}.cards{grid-template-columns:1fr}.scan{grid-template-columns:1fr}.badge{justify-self:start}}
</style></head><body>
<div class="top"><div><h1>SchoolID RFID Reader</h1><div class="muted">Live scans from this ESP32</div></div><span id="wifi" class="pill">Connecting…</span></div>
<div class="cards"><div class="card"><div class="label">Reader IP</div><div id="ip" class="value">—</div></div><div class="card"><div class="label">Server connection</div><div id="api" class="value">Waiting for scan</div></div></div>
<div class="section"><h2>Recent scans</h2><span id="count" class="muted">0 scans</span></div><div id="scans" class="list"><div class="empty">Tap an RFID card to see it here.</div></div>
<script>
const make=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n};
async function refresh(){try{const r=await fetch('/api/scans',{cache:'no-store'});const d=await r.json();document.querySelector('#ip').textContent=d.ip;const w=document.querySelector('#wifi');w.textContent=d.wifiConnected?'Wi-Fi connected':'Wi-Fi disconnected';document.querySelector('#api').textContent=d.apiState;document.querySelector('#count').textContent=d.total+' scans this session';const list=document.querySelector('#scans');list.replaceChildren();if(!d.scans.length){list.append(make('div','Tap an RFID card to see it here.','empty'));return}for(const s of d.scans){const row=make('article','','scan'),left=make('div',''),right=make('span',s.state,'badge');if(s.state==='Authorized')right.classList.add('ok');else if(s.state==='Unauthorized'||s.state==='Network error'||s.state==='Server error')right.classList.add('bad');else right.classList.add('pending');left.append(make('div',s.uid,'uid'));left.append(make('div',s.detail+' · '+s.ageSeconds+'s ago','detail'));row.append(left,right);list.append(row)}}catch(e){document.querySelector('#wifi').textContent='Dashboard reconnecting'}}refresh();setInterval(refresh,1000);
</script></body></html>
)HTML";

void handleDashboard() {
  dashboard.send_P(200, "text/html; charset=utf-8", DASHBOARD_HTML);
}

void handleLocalScans() {
  String json = "{\"ip\":\"" + WiFi.localIP().toString() + "\",\"wifiConnected\":";
  json += WiFi.status() == WL_CONNECTED ? "true" : "false";
  json += ",\"apiState\":\"" + jsonEscape(apiState) + "\",\"total\":" + String(scanCount) + ",\"scans\":[";
  for (uint8_t i = 0; i < scanCount; ++i) {
    if (i) json += ',';
    const unsigned long age = (millis() - scanHistory[i].scannedAt) / 1000;
    json += "{\"uid\":\"" + jsonEscape(scanHistory[i].uid) + "\",\"state\":\"" + jsonEscape(scanHistory[i].state)
      + "\",\"detail\":\"" + jsonEscape(scanHistory[i].detail) + "\",\"ageSeconds\":" + String(age)
      + ",\"httpCode\":" + String(scanHistory[i].httpCode) + "}";
  }
  json += "]}";
  dashboard.send(200, "application/json; charset=utf-8", json);
}

void startDashboard() {
  dashboard.on("/", HTTP_GET, handleDashboard);
  dashboard.on("/api/scans", HTTP_GET, handleLocalScans);
  dashboard.onNotFound([]() { dashboard.send(404, "text/plain", "Not found"); });
  dashboard.begin();
  Serial.printf("RFID dashboard: http://%s/\n", WiFi.localIP().toString().c_str());
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("Connecting to Wi-Fi '%s'", WIFI_SSID);
  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 20000) {
    setLed(WIFI_LED_PIN, !digitalRead(WIFI_LED_PIN));
    Serial.print('.');
    delay(350);
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    setLed(WIFI_LED_PIN, true);
    Serial.printf("Wi-Fi connected. ESP32 IP: %s\n", WiFi.localIP().toString().c_str());
    showStatus("Tap student card");
  } else {
    setLed(WIFI_LED_PIN, false);
    showStatus("Wi-Fi connection failed");
  }
}

void sendScan(const String& uid) {
  if (WiFi.status() != WL_CONNECTED) {
    apiState = "ESP32 offline; scan kept locally";
    updateLatestScan("Network error", "No Wi-Fi connection", -1);
    showStatus("No Wi-Fi; scan not sent");
    setLed(RED_LED_PIN, true);
    beep(3, 100, 100);
    return;
  }

  WiFiClient client;
  WiFiClientSecure secureClient;
  HTTPClient http;
  http.setConnectTimeout(5000);
  http.setTimeout(5000);
  Serial.printf("RFID API target: %s | ESP32 IP: %s\n", SCAN_URL, WiFi.localIP().toString().c_str());

  bool started = false;
  if (String(SCAN_URL).startsWith("https://")) {
    if (strlen(SCHOOLID_CA_CERT) > 0) {
      secureClient.setCACert(SCHOOLID_CA_CERT);
      started = http.begin(secureClient, SCAN_URL);
    }
  } else {
    started = http.begin(client, SCAN_URL);
  }
  if (!started) {
    apiState = "Could not start API connection";
    updateLatestScan("Network error", "API URL or TLS certificate is not configured", -1);
    showStatus("API URL or TLS certificate is not configured");
    setLed(RED_LED_PIN, true);
    beep(3, 100, 100);
    return;
  }
  http.addHeader("Content-Type", "application/json");
  if (strlen(SCHOOLID_RFID_DEVICE_KEY) > 0) http.addHeader("X-Device-Key", SCHOOLID_RFID_DEVICE_KEY);
  const String payload = String("{\"uid\":\"") + uid + "\"}";
  const int code = http.POST(payload);
  Serial.printf("RFID API returned HTTP %d (%s)\n", code, http.errorToString(code).c_str());

  if (code > 0) {
    const String response = http.getString();
    Serial.println("RFID API response: " + response);
    const bool authorized = response.indexOf("\"authorized\":true") >= 0;
    const String displayName = jsonStringField(response, "display");
    if (code == 200 && authorized) {
      apiState = "Connected (HTTP 200)";
      updateLatestScan("Authorized", displayName.length() ? displayName : "Student recognized", code);
      showStatus(displayName.length() ? displayName : "Authorized student");
      setLed(RED_LED_PIN, false);
      setLed(GREEN_LED_PIN, true);
      beep(1, 120, 0);
    } else if (code == 200) {
      apiState = "Connected (HTTP 200)";
      updateLatestScan("Unauthorized", "Card is not registered", code);
      showStatus("Unauthorized card: " + uid);
      setLed(GREEN_LED_PIN, false);
      setLed(RED_LED_PIN, true);
      beep(3, 90, 90);
    } else {
      apiState = "Server returned HTTP " + String(code);
      updateLatestScan("Server error", "HTTP " + String(code), code);
      showStatus("Server returned HTTP " + String(code));
      setLed(GREEN_LED_PIN, false);
      setLed(RED_LED_PIN, true);
      beep(2, 150, 100);
    }
  } else {
    apiState = "Connection failed: " + http.errorToString(code);
    updateLatestScan("Network error", http.errorToString(code), code);
    showStatus("Network error " + String(code) + ": " + http.errorToString(code));
    setLed(GREEN_LED_PIN, false);
    setLed(RED_LED_PIN, true);
    beep(2, 150, 100);
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(WIFI_LED_PIN, OUTPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  setLed(WIFI_LED_PIN, false);
  setLed(GREEN_LED_PIN, false);
  setLed(RED_LED_PIN, false);

  Serial.println("\nSchoolID RFID reader booting");
  Serial.printf("API endpoint: %s\n", SCAN_URL);
  connectWifi();

  SPI.begin(18, 19, 23, RFID_SS_PIN);
  reader.PCD_Init();
  Serial.println("MFRC522 initialized; waiting for cards");
  startDashboard();
  beep(1, 100, 0);
}

void loop() {
  dashboard.handleClient();
  if (WiFi.status() == WL_CONNECTED) setLed(WIFI_LED_PIN, true);
  else {
    setLed(WIFI_LED_PIN, false);
    static unsigned long lastReconnectAt = 0;
    if (millis() - lastReconnectAt > 10000) {
      lastReconnectAt = millis();
      WiFi.reconnect();
    }
  }

  if (millis() - lastScanAt < SCAN_COOLDOWN_MS) return;
  if (!reader.PICC_IsNewCardPresent() || !reader.PICC_ReadCardSerial()) return;

  lastScanAt = millis();
  const String uid = readUid();
  Serial.println("Scanned UID: " + uid);
  showStatus("Card scanned: " + uid);
  addLocalScan(uid);
  setLed(GREEN_LED_PIN, false);
  setLed(RED_LED_PIN, false);
  beep(1, 50, 0); // immediate physical scan feedback, independent of network response
  reader.PICC_HaltA();
  reader.PCD_StopCrypto1();
  sendScan(uid);
}

