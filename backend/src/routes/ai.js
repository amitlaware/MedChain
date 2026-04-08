// backend/src/routes/ai.js
// Hugging Face AI integration to query patient EHRs

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { withFabric } = require('../services/fabricService');
const { StorageService } = require('../services/storageService');

const router = express.Router();
const storage = new StorageService();

router.post('/chat', authenticate, async (req, res, next) => {
  try {
    const { ehrId, question } = req.body;
    if (!ehrId || !question) {
      return res.status(400).json({ error: 'ehrId and question are required' });
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'HUGGINGFACE_API_KEY is not set in .env' });
    }

    // 1. Verify access on-chain and retrieve IPFS info
    const ehr = await withFabric(req.user.fabricId, req.user.orgMsp, async (fabric) => {
      return fabric.query('viewRecord', ehrId);
    });

    // 2. Download and decrypt the actual EHR file from IPFS
    const encryptionMeta = JSON.parse(ehr.encKey);
    const fileBuffer = await storage.downloadFromIPFS(ehr.ipfsHash, encryptionMeta);
    
    // For simplicity, we convert the buffer to text. 
    // (If dealing with images, OCR would be required here. If PDF, pdf-parse).
    const ehrText = fileBuffer.toString('utf-8');

    // 3. Create a prompt for the Hugging Face Model
    const systemPrompt = `You are a medical AI assistant. Answer the doctor's query based ONLY on the provided EHR context. If the answer is not in the context, say "I cannot determine this from the given records." Do NOT invent medical information.\n\nEHR CONTEXT:\n${ehrText.substring(0, 4000)}\n\nDOCTOR'S QUESTION:\n${question}\n\nANSWER:`;

    // 4. Query Hugging Face free Inference API (using a fast instructed model)
    const response = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: systemPrompt,
          parameters: { max_new_tokens: 150, temperature: 0.1 }
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: "AI API Error", details: errText });
    }

    const aiResult = await response.json();
    const answer = aiResult[0]?.generated_text?.split("ANSWER:")[1]?.trim() || "No valid response generated.";

    res.json({ answer });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
