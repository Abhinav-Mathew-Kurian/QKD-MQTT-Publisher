// producer.js
import mqtt from "mqtt";
import fs from "fs";
import crypto from "crypto";

// -------- CONFIG --------
const BROKER_URL = "mqtts://004cb224a1134432ba854a0ad72c478e.s1.eu.hivemq.cloud";
const USERNAME = "abhinav";
const PASSWORD = "abCD1234";

const TOPIC = 'sensors/battery_current';         
const KEY_FILE = './keys/battery_current.json';      
// -------------------------

// Load key
const keyJson = JSON.parse(fs.readFileSync(KEY_FILE, "utf8"));
const key = Buffer.from(keyJson.key_b64, "base64");

// Connect to HiveMQ
const client = mqtt.connect(BROKER_URL, {
  username: USERNAME,
  password: PASSWORD,
  rejectUnauthorized: true
});

let current = 0; 
let state = "driving"; // driving | charging

client.on("connect", () => {
  console.log(`🚀 Producer connected, publishing battery_current to ${TOPIC} every 3s...`);

  setInterval(() => {
    // --- Update battery current realistically ---
    if (state === "driving") {
      // Normal driving discharge
      current = -1 * (50 + Math.random() * 120); // -50 to -170 A
      
      // Occasional regen braking spike
      if (Math.random() < 0.1) {
        current = -1 * (20 + Math.random() * 50); // mild regen -20 to -70 A
      }

      // Switch to charging if "battery low"
      if (Math.random() < 0.05) state = "charging";
    } 
    else if (state === "charging") {
      // DC fast charging profile
      if (current < 80) {
        current = 150 + Math.random() * 80; // 150–230 A
      } else {
        current = 40 + Math.random() * 30; // taper 40–70 A
      }

      // Switch back to driving after charge cycle
      if (Math.random() < 0.05) state = "driving";
    }

    const payload = {
      timestamp: new Date().toISOString(),
      battery_current: parseFloat(current.toFixed(2))
    };

    // --- Encrypt ---
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let enc = cipher.update(JSON.stringify(payload), "utf8");
    enc = Buffer.concat([enc, cipher.final()]);
    const tag = cipher.getAuthTag();

    const encryptedMsg = {
      v: 1,
      alg: keyJson.alg,
      kid: keyJson.kid,
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      data: enc.toString("base64")
    };

    // --- Publish ---
    client.publish(TOPIC, JSON.stringify(encryptedMsg));
    console.log(`📡 Published encrypted to ${TOPIC} | Payload: ${JSON.stringify(encryptedMsg)}`);

  }, 3000);
});
