const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const PORT = process.env.PORT || 3000;

// Modelo que funciona para prompt puro - Wan 2.2 es el mejor para cartoon 3D como Cartoon Studio
// Si quieres volver a minimax, cambia a "minimax/video-01"
const REPLICATE_MODEL = process.env.REPLICATE_MODEL || "wan-video/wan-2.2-t2v-a14b";

app.get('/', (req, res) => {
  res.send('PromptVideo AI proxy OK - Modelo: ' + REPLICATE_MODEL);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: REPLICATE_MODEL, has_token: !!REPLICATE_API_TOKEN });
});

app.post('/generate', async (req, res) => {
  try {
    const { prompt, duration = 5 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Falta el prompt' });
    }

    if (!REPLICATE_API_TOKEN) {
      return res.status(500).json({ error: 'Falta REPLICATE_API_TOKEN en Environment de Render' });
    }

    console.log('Generando video para prompt:', prompt);

    // Crear predicción - formato compatible con Wan 2.2 y minimax
    let input = {};
    
    if (REPLICATE_MODEL.includes('wan')) {
      input = {
        prompt: prompt + ", 3D cartoon style, pixar style, bright colors, cute characters",
        duration: parseInt(duration) || 5,
        resolution: "720p",
        aspect_ratio: "16:9"
      };
    } else {
      // minimax y otros
      input = { prompt };
    }

    const createRes = await fetch('https://api.replicate.com/v1/models/' + REPLICATE_MODEL + '/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    });

    let createData;
    try {
      createData = await createRes.json();
    } catch (e) {
      const text = await createRes.text();
      return res.status(500).json({ error: 'Replicate no respondió JSON', detail: text, status: createRes.status });
    }

    if (!createRes.ok) {
      console.error('Error Replicate create:', createData);
      return res.status(createRes.status).json({
        error: 'Error en Replicate',
        detail: createData,
        status: createRes.status,
      });
    }

    // Polling con más tiempo (hasta 5 minutos)
    let prediction = createData;
    const getUrl = prediction.urls.get;
    let attempts = 0;
    const maxAttempts = 60; // 60 x 3s = 3 minutos

    while ((prediction.status === 'starting' || prediction.status === 'processing') && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 3000));
      const pollRes = await fetch(getUrl, {
        headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` },
      });
      prediction = await pollRes.json();
      console.log(`Intento ${attempts}: ${prediction.status}`);
      attempts++;
    }

    if (prediction.status === 'succeeded') {
      const output = prediction.output;
      const videoUrl = Array.isArray(output) ? output[0] : output;
      console.log('Video generado:', videoUrl);
      return res.json({ 
        video_url: videoUrl, 
        url: videoUrl,
        status: 'succeeded',
        model: REPLICATE_MODEL
      });
    } else {
      console.error('Falló predicción:', prediction);
      return res.status(500).json({
        error: 'No se pudo generar el video - timeout o fallo',
        status: prediction.status,
        detail: prediction.error || prediction,
      });
    }
  } catch (err) {
    console.error('Error interno:', err);
    res.status(500).json({ error: 'Error interno del proxy', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy escuchando en puerto ${PORT} con modelo ${REPLICATE_MODEL}`);
});
