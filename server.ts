import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini client to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("WARNING: GEMINI_API_KEY is not defined in environment variables.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// API Route: AI Remastering powered by Gemini
app.post('/api/ai/remaster', async (req, res) => {
  const { trackName, artist, genre, style, prompt, currentBands } = req.body;

  console.log(`[AI Remaster Request] Track: "${trackName}" by ${artist} | Style: ${style}`);

  // Fallback preset values if AI is not available or errors out
  const fallbackPresets: Record<string, { gains: number[]; preamp: number; surround: number; compressor: boolean; explanation: string }> = {
    car_hifi: {
      gains: [6, 4.5, 3, 1.5, -1, 0, 1.5, 3, 4.5, 5],
      preamp: 1.1,
      surround: 45,
      compressor: true,
      explanation: "Ottimizzazione acustica per Auto completata: Rinforzato lo spettro dei bassi profondi per contrastare il rumore stradale, esaltate le medie frequenze vocali per una maggiore intelligibilità ed estesa la spazializzazione stereo 3D."
    },
    studio: {
      gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      preamp: 1.0,
      surround: 0,
      compressor: false,
      explanation: "Remasterizzazione Studio Reference applicata: Risposta in frequenza totalmente lineare per un ascolto analitico e puro, preservando la dinamica originale senza compressioni o spazializzazioni artificiali."
    },
    vinyl: {
      gains: [4, 3, 1, 0.5, -0.5, -1, 0, 1, 2, -1.5],
      preamp: 1.0,
      surround: 25,
      compressor: false,
      explanation: "Firma sonora Warm Vinyl attiva: Risposta acustica calda caratterizzata da bassi pastosi, medie frequenze attenuate per eliminare le asprezze digitali e un roll-off morbido sulle altissime frequenze."
    },
    loudness: {
      gains: [6, 4, 1.5, -1, -2, -1, 1.5, 3, 5, 5.5],
      preamp: 1.25,
      surround: 50,
      compressor: true,
      explanation: "Elaborazione Loudness Maximizer conclusa: Curva a 'sorriso' enfatizzata, preamp potenziato e compressore multibanda inserito per massimizzare la pressione sonora d'impatto su altoparlanti e cuffie digitali."
    },
    clear_vocal: {
      gains: [-3, -2, -1, 1, 3.5, 5, 4, 3, 1, -1.5],
      preamp: 1.05,
      surround: 20,
      compressor: true,
      explanation: "Ottimizzazione Clear Vocal attiva: Attenuate le frequenze sub-bassi per pulire il fango acustico, ed enfatizzate in modo chirurgico le frequenze di presenza (1kHz - 4kHz) per far risaltare la voce al centro della scena."
    }
  };

  const ai = getGeminiClient();

  if (!ai) {
    // If API key is missing, return fallback immediately
    const fallback = fallbackPresets[style] || fallbackPresets.car_hifi;
    return res.json({
      ...fallback,
      note: "Eseguito con algoritmo DSP locale pre-configurato (Gemini API Key non configurata)."
    });
  }

  try {
    const systemPrompt = `Sei un Ingegnere del Suono e Mastering Designer di fama mondiale. Il tuo compito è analizzare una traccia musicale e calcolare la calibrazione acustica ideale (10 bande di equalizzazione grafica, guadagno pre-amplificatore, livello spazializzazione e compressore di dinamica) in base allo stile richiesto dall'utente.
Gli stili disponibili sono:
- car_hifi: Ottimizzazione per auto (bassi profondi energetici per vincere il rumore del motore/strada, medi puliti, surround ampio).
- studio: Risposta lineare flat, fedeltà millimetrica da studio di registrazione.
- vinyl: Suono vintage e caldo, bassi morbidi, medi ricchi, roll-off sulle altissime frequenze aspre.
- loudness: Energetico, impatto massimo, curva a sorriso (V-shape) marcata, compressione attiva.
- clear_vocal: Massimo dettaglio per voci e podcast, taglia i sub-bassi, enfatizza i medi e alti intelligibili.

Dati canzone:
- Titolo: "${trackName || 'Sconosciuto'}"
- Artista: "${artist || 'Sconosciuto'}"
- Genere originario: "${genre || 'Sconosciuto'}"
- Stile di Remastering richiesto: "${style}"
- Note/Richieste custom dell'utente: "${prompt || 'Nessuna richiesta speciale'}"
- Bande correnti: ${JSON.stringify(currentBands || [])}

Genera un oggetto JSON contenente le seguenti proprietà:
1. gains: un array di esattamente 10 numeri decimali. Ognuno rappresenta il guadagno in dB per le rispettive frequenze: 31Hz, 62Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz. I valori devono essere compresi tassativamente tra -12.0 e 12.0 (es. [3.5, 4.0, 1.5, -1.0, -2.0, 0.5, 2.0, 1.5, 3.0, 2.5]).
2. preamp: un coefficiente moltiplicativo per il pre-amp complessivo compreso tra 0.80 e 1.40.
3. surround: un valore percentuale di spazializzazione virtuale 3D compreso tra 0 e 80.
4. compressor: booleano (true o false) per attivare o disattivare il compressore/limiter.
5. explanation: una bellissima spiegazione in lingua italiana (lunga 2 o 3 frasi), scritta in modo professionale e carismatico dal punto di vista del fonico, che descrive quali interventi di equalizzazione e dinamica sono stati applicati e perché trasformeranno l'ascolto in macchina o in cuffia.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        { text: systemPrompt }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gains: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
              description: "Array of exactly 10 numbers from -12.0 to +12.0 representing EQ bands from 31Hz to 16kHz."
            },
            preamp: {
              type: Type.NUMBER,
              description: "Pre-amp multiplier gain, between 0.8 and 1.4."
            },
            surround: {
              type: Type.NUMBER,
              description: "Surround sound virtualization percentage, from 0 to 80."
            },
            compressor: {
              type: Type.BOOLEAN,
              description: "Whether the dynamics compressor/limiter is enabled."
            },
            explanation: {
              type: Type.STRING,
              description: "An elegant, precise 2-3 sentence explanation in Italian of the remaster details."
            }
          },
          required: ["gains", "preamp", "surround", "compressor", "explanation"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response text from Gemini API.");
    }

    const parsedResult = JSON.parse(resultText.trim());

    // Validate size of gains array
    if (!Array.isArray(parsedResult.gains) || parsedResult.gains.length !== 10) {
      // Force exactly 10 bands if format is incorrect
      parsedResult.gains = (fallbackPresets[style] || fallbackPresets.car_hifi).gains;
    }

    // Ensure values are within limits
    parsedResult.gains = parsedResult.gains.map((g: number) => Math.max(-12, Math.min(12, Math.round(g * 2) / 2)));
    parsedResult.preamp = Math.max(0.8, Math.min(1.4, parsedResult.preamp));
    parsedResult.surround = Math.max(0, Math.min(80, Math.round(parsedResult.surround)));
    parsedResult.compressor = !!parsedResult.compressor;

    return res.json(parsedResult);

  } catch (error) {
    console.error("Gemini Remaster API Error:", error);
    // Graceful fallback on any error
    const fallback = fallbackPresets[style] || fallbackPresets.car_hifi;
    return res.json({
      ...fallback,
      note: "Eseguito con algoritmo DSP locale pre-configurato (si è verificato un errore di connessione con Gemini)."
    });
  }
});

// Vite & Static Asset integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PureAudio Server] Listening on http://localhost:${PORT}`);
  });
}

startServer();
