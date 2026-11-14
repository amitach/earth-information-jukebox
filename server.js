const express = require("express");
const path = require("path");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const PORT = 3000;

// This safely grabs your key from your .env file
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());
app.use(express.static(__dirname));

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "No message received."
      });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are the PA for Earth Information Jukebox. You speak naturally, warmly, and clearly. Your purpose is to help users explore Earth's weather and environment through conversation. Keep responses conversational and reasonably short because they will be spoken aloud by text-to-speech.`
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    const replyText = completion.choices[0].message.content;

    res.json({
      reply: replyText
    });

  } catch (error) {
    console.error("AI ERROR:", error);
    res.status(500).json({
      error: "The PA could not respond."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Earth Information Jukebox running at http://localhost:${PORT}`);
});