require("dotenv").config({ quiet: true });

const path = require("path");
const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const MAX_MESSAGE_LENGTH = 2000;
// Number of earlier messages (user + PA) sent back to Gemini for context.
const MAX_HISTORY_MESSAGES = 20;

const SYSTEM_INSTRUCTION = `You are the PA for Earth Information Jukebox. You speak naturally, warmly, and clearly. Your purpose is to help users explore Earth's weather and environment through conversation.

Every reply is read aloud by text-to-speech, so:
- Keep replies short and conversational, usually two to four sentences.
- Use plain spoken sentences only. Never use markdown, lists, headings, emoji, or links.
- Write numbers, symbols, and units the way they are spoken, for example "20 degrees Celsius" instead of "20°C".

You do not have live weather data or the user's location. If asked about current conditions or forecasts, say so briefly, then offer general information or suggest checking a local weather service.`;

if (!GEMINI_API_KEY) {
  console.warn(
    "GEMINI_API_KEY is not set. The page will load, but the PA cannot answer until you add it to .env (see .env.example)."
  );
}

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const app = express();

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Turn the client's [{ role, text }] history into Gemini contents.
function toGeminiHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  const turns = history
    .filter(
      (turn) =>
        turn &&
        (turn.role === "user" || turn.role === "model") &&
        typeof turn.text === "string" &&
        turn.text.trim()
    )
    .slice(-MAX_HISTORY_MESSAGES);

  // A conversation sent to Gemini should start with the user.
  while (turns.length && turns[0].role !== "user") {
    turns.shift();
  }

  return turns.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text.slice(0, MAX_MESSAGE_LENGTH) }]
  }));
}

// Strip leftover markdown so the text-to-speech voice doesn't read symbols aloud.
function toSpeakableText(text) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*(?:[-*•]|\d+\.)\s+/gm, "")
    .replace(/[*#`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function logGeminiError(error) {
  const hints = {
    400: "Gemini rejected the request. Check GEMINI_API_KEY and GEMINI_MODEL in .env.",
    401: "GEMINI_API_KEY is not valid. Create one at https://aistudio.google.com/apikey.",
    403: "GEMINI_API_KEY does not have access to this model.",
    404: `Model "${GEMINI_MODEL}" was not found. Set GEMINI_MODEL in .env to an available model.`,
    429: "Gemini rate limit or quota exceeded."
  };

  console.error("GEMINI ERROR:", error.status ?? "", error.message);

  if (hints[error.status]) {
    console.error("Hint:", hints[error.status]);
  }
}

app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body ?? {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "No message received." });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: "That message is too long." });
  }

  if (!ai) {
    return res.status(503).json({
      error: "The PA isn't set up yet. Add a Gemini API key to the server's .env file."
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        ...toGeminiHistory(history),
        { role: "user", parts: [{ text: message.trim() }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION
      }
    });

    const reply = toSpeakableText(response.text ?? "");

    if (!reply) {
      console.error(
        "GEMINI EMPTY REPLY:",
        response.candidates?.[0]?.finishReason ?? response.promptFeedback?.blockReason ?? "unknown"
      );

      return res.status(502).json({
        error: "I don't have an answer for that. Could you try asking another way?"
      });
    }

    res.json({ reply });
  } catch (error) {
    logGeminiError(error);

    if (error.status === 429) {
      return res.status(429).json({
        error: "I'm getting a lot of questions right now. Please try again in a moment."
      });
    }

    res.status(502).json({ error: "The PA could not respond. Please try again." });
  }
});

// Return JSON (not an HTML error page) for bad request bodies and other errors.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || error.statusCode || 500;

  if (status >= 500) {
    console.error("SERVER ERROR:", error);
  }

  res.status(status).json({
    error: status < 500 ? "The request could not be read." : "Something went wrong on the server."
  });
});

app.listen(PORT, (error) => {
  if (error) {
    console.error(`Could not start the server on port ${PORT}:`, error.message);
    process.exit(1);
  }

  console.log(`Earth Information Jukebox running at http://localhost:${PORT} (model: ${GEMINI_MODEL})`);
});
