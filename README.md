# EchoCoach - AI English Pronunciation Assistant

EchoCoach is a React application powered by Google's Gemini 2.5 Flash API. It helps users practice English pronunciation by providing real-time AI feedback, speech synthesis (TTS), and visual scoring.

## Features

- **AI Speech Synthesis**: Hear native-level pronunciation of any text using Gemini TTS (`gemini-2.5-flash-preview-tts`).
- **Real-time Recording**: Record your voice directly in the browser.
- **Voice Activity Detection (VAD)**: Automatically stops recording when you finish speaking.
- **AI Analysis**: Get instant feedback on your pronunciation accuracy, intonation, and specific word corrections (`gemini-2.5-flash`).
- **Playback**: Replay your own recording or listen to the AI coach's advice.
- **History**: Save and search your practice sessions.

## Environment Variables

To run this app, you need a Google Gemini API Key.

| Variable | Description |
| t-------- | ----------- |
| `API_KEY` | Your Google GenAI API Key (get one at [aistudio.google.com](https://aistudio.google.com)) |

## How to Run Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/your-repo-name.git
   cd your-repo-name
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API Key**
   Create a `.env` file in the root directory (or configure your bundler's environment variables):
   ```
   API_KEY=your_actual_api_key_here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

## How to Deploy (Recommended: Vercel)

1. Push your code to a **GitHub** repository.
2. Go to [Vercel](https://vercel.com) and sign up with GitHub.
3. Click **"Add New Project"** and import your repository.
4. In the **"Environment Variables"** section:
   - Add Name: `API_KEY`
   - Add Value: `Your_Actual_Gemini_API_Key`
5. Click **"Deploy"**.
6. Once finished, Vercel will give you a live URL to share and use.
