const http = require("http");
const fs = require("fs");
const path = require("path");

require('dotenv').config({ path: '/home/ubuntu/cyberboss/.env' });

const PORT = 4321;
const DATA_DIR = path.join(require("os").homedir(), ".cyberboss", "phone-data");
const AUTH_TOKEN = process.env.CYBERBOSS_LOCATION_TOKEN;

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")); } catch { return []; }
}

function appendJson(file, entry) {
  var data = readJson(file);
  data.push(entry);
  var trimmed = data.slice(-200);
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(trimmed, null, 2), "utf8");
}

function logEvent(event) {
  var today = new Date().toISOString().slice(0, 10);
  appendJson("events-" + today + ".json", event);
}

function parseQuery(url) {
  var qs = (url || "").split("?")[1] || "";
  var params = {};
  qs.split("&").forEach(function(p) {
    var parts = p.split("=");
    if (parts[0]) params[parts[0]] = decodeURIComponent(parts[1] || "");
  });
  return params;
}

var server = http.createServer(function(req, res) {
  var auth = req.headers.authorization || "";
  var now = new Date().toISOString();

  // --- public GET endpoints (no auth needed) ---

  if (req.url && req.url.startsWith("/loc")) {
    var q = parseQuery(req.url);
    var lat = parseFloat(q.lat) || 0;
    var lng = parseFloat(q.lng) || 0;
    if (lat && lng) {
      var locBody = JSON.stringify({ latitude: lat, longitude: lng });
      var lr = http.request({
        hostname: "0.0.0.0", port: 4318, path: "/location/ingest", method: "POST",
        headers: {
          "Authorization": "Bearer " + AUTH_TOKEN,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(locBody)
        }
      }, function(locRes) {
        var b = "";
        locRes.on("data", function(c) { b += c; });
        locRes.on("end", function() { res.writeHead(200); res.end(b); });
      });
      lr.on("error", function() { res.writeHead(502); res.end(JSON.stringify({error:"upstream"})); });
      lr.write(locBody);
      lr.end();
    } else {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "lat/lng required" }));
    }
    return;
  }

  if (req.url && req.url.startsWith("/app")) {
    var aq = parseQuery(req.url);
    var entry = {
      time: now,
      app: aq.pkg || aq.app || "",
      event: aq.evt || "open",
      duration: 0
    };
    logEvent(entry);
    var summary = { lastApp: entry.app, lastEvent: entry.event, lastTime: now };
    fs.writeFileSync(path.join(DATA_DIR, "latest.json"), JSON.stringify(summary, null, 2), "utf8");
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  console.log("[phone-reporter] " + req.method + " " + req.url + " auth=" + (auth ? "yes" : "none"));

  // --- authenticated endpoints below ---

  if (!auth.includes(AUTH_TOKEN)) {
    res.writeHead(403);
    res.end(JSON.stringify({ error: "forbidden" }));
    return;
  }

  var body = "";
  req.on("data", function(c) { body += c; });
  req.on("end", function() {
    try {
      var data = JSON.parse(body || "{}");

      if (req.url === "/location") {
        var lr2 = http.request({
          hostname: "0.0.0.0", port: 4318, path: "/location/ingest", method: "POST",
          headers: {
            "Authorization": "Bearer " + AUTH_TOKEN,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body)
          }
        }, function(locRes) {
          var b2 = "";
          locRes.on("data", function(c) { b2 += c; });
          locRes.on("end", function() { res.writeHead(200); res.end(b2); });
        });
        lr2.on("error", function() { res.writeHead(502); res.end(JSON.stringify({error:"upstream"})); });
        lr2.write(body);
        lr2.end();
        return;
      }

      if (req.url === "/activity") {
        var e2 = {
          time: now,
          app: data.app || data.packageName || "",
          event: data.event || "open",
          duration: data.duration || 0
        };
        logEvent(e2);
        var s2 = { lastApp: e2.app, lastEvent: e2.event, lastTime: now };
        fs.writeFileSync(path.join(DATA_DIR, "latest.json"), JSON.stringify(s2, null, 2), "utf8");
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: "not found" }));
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
  });
});

server.listen(PORT, "0.0.0.0", function() {
  console.log("[phone-reporter] listening on 0.0.0.0:" + PORT);
  console.log("[phone-reporter] endpoints: /loc /app /location /activity");
});
