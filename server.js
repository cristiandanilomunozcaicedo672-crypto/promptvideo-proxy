import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
const MODEL_VERSION = process.env.MODEL_VERSION || "wan-video/wan-2.2-t2v";

app.get("/", (req, res) => res.send("PromptVideo AI proxy OK"));

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, duration = 5, aspect_ratio = "16:9" } = req.body;
    if (!REPLICATE_TOKEN) return res.status(500).json({ error: "Falta REPLICATE_API_TOKEN en el servidor" });
    if (!prompt) return res.status(400).json({ error: "Falta prompt" });
    const r = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL_VERSION,
        input: { prompt, duration, aspect_ratio }
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/status/:id", async (req, res) => {
  try {
    const r = await fetch(`https://api.replicate.com/v1/predictions/${req.params.id}`, {
      headers: { "Authorization": `Token ${REPLICATE_TOKEN}` }
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy listo en puerto ${PORT}`));
