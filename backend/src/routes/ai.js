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

    const pdfParse = require('pdf-parse');

    // 2. Download and decrypt the actual EHR file from IPFS
    const encryptionMeta = JSON.parse(ehr.encKey);
    const fileBuffer = await storage.downloadFromIPFS(ehr.ipfsHash, encryptionMeta);
    
    let ehrText = "";
    if (ehr.metadata?.fileName?.toLowerCase().endsWith('.pdf') || ehr.metadata?.mimeType === 'application/pdf') {
      try {
        const pdfData = await pdfParse(fileBuffer);
        ehrText = pdfData.text; // Extracted PDF text
      } catch (err) {
        console.error('PDF Parse Error:', err);
        ehrText = "Error: Could not parse the PDF file contents.";
      }
    } else {
      ehrText = fileBuffer.toString('utf-8'); // Fallback for raw text formats (.txt, .csv)
    }

    // 3. Create a prompt for the Hugging Face Model
    const systemPrompt = `You are a medical AI assistant. Answer the doctor's query based ONLY on the provided EHR context. If the answer is not in the context, say "I cannot determine this from the given records." Do NOT invent medical information.\n\nEHR CONTEXT:\n${ehrText.substring(0, 4000)}`;

    const { HfInference } = require('@huggingface/inference');
    const hf = new HfInference(apiKey);

    try {
      const result = await hf.chatCompletion({
        model: 'meta-llama/Llama-3.2-1B-Instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        max_tokens: 150,
        temperature: 0.1
      });

      const answer = result.choices[0]?.message?.content?.trim() || "No valid response generated.";
      res.json({ answer });
    } catch (hfError) {
      console.error(hfError);
      return res.status(500).json({ error: "HuggingFace API Error: " + (hfError.message || hfError) });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
