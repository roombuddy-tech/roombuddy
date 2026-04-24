# RoomBuddy Frontend

React Native app built with Expo + TypeScript.

## Getting Started

### Prerequisites

- **Node.js** v18+ — [Download](https://nodejs.org/)
- **Expo Go** app on your phone — [Android](https://play.google.com/store/apps/details?id=host.exp.exponent) | [iOS](https://apps.apple.com/app/expo-go/id982107779)

### Setup

```bash
cd roombuddy/frontend
npm install
npx expo start
```

Scan the QR code with Expo Go. The app loads on your phone with hot reload.

### Mock Mode

Auth flow works without a backend. OTP code is **123456**.

To connect real APIs, open `src/constants/config.ts` and set `USE_MOCK: false`.

### Common Fixes

```bash
# Permission error
sudo chown -R $(whoami) ~/.npm

# Cache issues
npx expo start --clear

# Phone can't connect — use tunnel mode
npx expo install @expo/ngrok
npx expo start --tunnel
```