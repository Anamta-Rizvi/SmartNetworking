# Campus OS

An intelligent campus platform for event discovery and AI-powered networking.

---

## Backend (FastAPI + SQLite)

### Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Run

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

API docs available at: `http://localhost:8000/docs`

### Environment

```bash
cp .env.example .env
# Add your OpenAI API key to .env
```

---

## Mobile (React Native + Expo)

### Setup

```bash
cd mobile
npm install
npx expo install expo-av expo-speech @react-native-async-storage/async-storage
```

### Run

```bash
npx expo start
```

Press `i` for iOS Simulator, `a` for Android, or scan the QR code with Expo Go.

### Physical Device

Update `src/api/client.ts` with your machine's local IP:

```ts
export const API_BASE = 'http://<YOUR_LOCAL_IP>:8000';
```

Find your IP with: `ipconfig getifaddr en0`

Make sure your phone and Mac are on the same Wi-Fi network.

---

## Notes

- The backend seeds 35+ dummy events automatically on first run
- SQLite database is stored at `backend/campus_os.db`
- Voice mode in Copilot requires an OpenAI API key (uses Whisper for transcription)
