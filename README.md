# Android TV Web Remote

A local web-based remote for Android TV / Google TV devices.

It uses the Android TV Remote v2 protocol over the local network. No ADB is required.

## How it works

```text
Browser
   |
   | HTTP
   v
Local Node.js server
   |
   | TLS / Android TV Remote v2
   v
Android TV / Google TV
```

The TV must be reachable from the computer running this project. The remote protocol normally uses TCP port `6466` for remote control and `6467` for pairing.

## Requirements

- Node.js 18+
- Android TV / Google TV
- Computer and TV on the same local network
- TV must expose Android TV Remote v2
- Network access to TCP 6466 and 6467

## Install

### Option 1: Using Git (Recommended)
Open Command Prompt and run:
```bash
git clone [https://github.com/Uzzaircoding/uzzaircoding-atv-remote.git](https://github.com/Uzzaircoding/uzzaircoding-atv-remote.git) android-tv-web-remote
cd android-tv-web-remote
npm install && npm start
```
### Option 2: Using download link
Click the link below 
Click [here to download the project files](https://github.com/Uzzaircoding/uzzaircoding-atv-remote/archive/refs/heads/main.zip).
then extract it and run:

```bash
cd android-tv-web-remote
npm install && npm start
```



Then open:

```text
http://localhost:3000
```

## Pairing

1. Enter the TV IP address, or use **Scan network**.
2. Click **Connect / Pair**.
3. Your TV should display a pairing code.
4. Enter the six-character code in the browser.
5. The certificate is saved locally in `tv-certificate.json`.
6. Future connections can reuse the saved certificate.

## Security

The server is intended to run on a trusted local network.

Do **not** expose port 3000 directly to the public internet. The browser UI can be hosted publicly, but the Node server that controls a TV should run locally on the user's computer.

The TV pairing certificate is sensitive and is deliberately excluded from Git with `.gitignore`.

## GitHub Pages

The `public/` folder is a normal static web UI, but GitHub Pages alone cannot control TVs on private LANs. A local Node server is required for the TV connection.

## License

MIT
