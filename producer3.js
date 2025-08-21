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
let charging = true;

client.on("connect", () => {
  console.log(`🚀 Producer connected, publishing battery_current to ${TOPIC} every 3s...`);

  setInterval(() => {
    const payload = {
      timestamp: new Date().toISOString(),
      battery_current: current
    };

    // Encrypt
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

    client.publish(TOPIC, JSON.stringify(encryptedMsg));
    console.log(`📡 Published encrypted to ${TOPIC} | Payload: ${JSON.stringify(encryptedMsg)}`);


    if (charging) {
      current += 10;
      if (current >= 200) charging = false; 
    } else {
      current -= 10; 
      if (current <= -150) charging = true; 
    }

  }, 3000);
});

