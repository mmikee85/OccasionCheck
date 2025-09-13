// Importeer de officiële Google AI package
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- De hoofd export, de functie die Vercel zal aanroepen ---
module.exports = async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API sleutel is niet geconfigureerd op de server.");
        }
        
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        
        const targetUrl = req.query.url;
        if (!targetUrl) {
            return res.status(400).json({ error: 'Geen URL meegegeven.' });
        }

        // --- SPECIALIST 1: DE PRIJSSCANNER ---
        console.log("Stap 1: Prijsscanner wordt aangeroepen.");
        const scrapingPrompt = `
            Je bent een data-extractie bot. Bezoek de URL "${targetUrl}" met de 'google_search_retrieval' tool.
            Analyseer de HTML en vind de VRAAGPRIJS en de KILOMETERSTAND.
            Negeer alle andere informatie. Geef alleen een JSON-object terug met de volgende structuur:
            { "price": number, "kilometerstand": "string" }
            Als je een waarde niet kunt vinden, gebruik dan null.
        `;

        const scrapingResult = await model.generateContent({
            contents: [{ parts: [{ text: scrapingPrompt }] }],
            tools: [{ "google_search_retrieval": {} }],
        });

        const scrapingResponseText = scrapingResult.response.text();
        const jsonStartIndexScrape = scrapingResponseText.indexOf('{');
        const jsonEndIndexScrape = scrapingResponseText.lastIndexOf('}');
        if (jsonStartIndexScrape === -1 || jsonEndIndexScrape === -1) {
            throw new Error('Prijsscanner kon geen geldige data vinden.');
        }
        const scrapingJsonString = scrapingResponseText.substring(jsonStartIndexScrape, jsonEndIndexScrape + 1);
        const scrapedData = JSON.parse(scrapingJsonString);

        if (scrapedData.price === null || scrapedData.kilometerstand === null) {
             throw new Error('De Prijsscanner kon de prijs of kilometerstand niet vinden op de pagina.');
        }
        
        console.log("Stap 1 succesvol. Gevonden data:", scrapedData);

        // --- SPECIALIST 2: DE MARKTANALIST ---
        console.log("Stap 2: Marktanalist wordt aangeroepen.");
        const analysisPrompt = `
            Je bent 'OccasionCheck AI', een expert in het analyseren van auto-advertenties.
            Ik geef je de correcte, geverifieerde data van een auto. Jouw taak is om de volledige analyse te schrijven.
            
            **GEGEVENS:**
            - URL: ${targetUrl}
            - Vraagprijs: ${scrapedData.price}
            - Kilometerstand: "${scrapedData.kilometerstand}"

            **PROTOCOL:**
            1.  **ONDERZOEK URL (OPTIONEEL):** Bezoek de URL met je 'google_search_retrieval' tool om extra context te krijgen (zoals titel, opties, foto's).
            2.  **GENEREER ANALYSE:** Gebruik de GEGEVENS hierboven als de absolute waarheid voor prijs en km-stand. Schrijf de volledige analyse.
            3.  **VOER UIT:** Genereer een JSON-object volgens de onderstaande structuur.

            **GEEF NU EEN GELDIG JSON-OBJECT TERUG MET DEZE STRUCTURUR:**
            {
              "isSpecificAdAnalysis": true,
              "title": "...",
              "photos": ["url1", "url2", "url3", "url4"],
              "marketAnalysis": "...",
              "price": ${scrapedData.price},
              "specs": { "Merk": "...", "Model": "...", "Bouwjaar": "...", "Kilometerstand": "${scrapedData.kilometerstand}", "Brandstof": "...", "Transmissie": "..." },
              "pluspunten": ["..."],
              "minpunten": ["..."],
              "onderhandelingsadvies": "...",
              "eindconclusie": "...",
              "score": 8.5
            }
        `;

        const analysisResult = await model.generateContent({
            contents: [{ parts: [{ text: analysisPrompt }] }],
            tools: [{ "google_search_retrieval": {} }],
        });

        const analysisResponseText = analysisResult.response.text();
        const jsonStartIndexAnalysis = analysisResponseText.indexOf('{');
        const jsonEndIndexAnalysis = analysisResponseText.lastIndexOf('}');
        if (jsonStartIndexAnalysis === -1 || jsonEndIndexAnalysis === -1) {
            throw new Error('Marktanalist gaf een onverwacht antwoord.');
        }
        const analysisJsonString = analysisResponseText.substring(jsonStartIndexAnalysis, jsonEndIndexAnalysis + 1);
        const finalAnalysis = JSON.parse(analysisJsonString);
        
        console.log("Stap 2 succesvol. Analyse compleet.");

        res.status(200).json(finalAnalysis);

    } catch (error) {
        console.error('Fout opgevangen in de hoofdfunctie:', error);
        res.status(500).json({
            error: error.message || "Er is een onbekende serverfout opgetreden."
        });
    }
};

