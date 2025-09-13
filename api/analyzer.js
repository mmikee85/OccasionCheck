// Importeer de officiële Google AI package
const { GoogleGenerativeAI } = require('@google-generative-ai');

// --- Functie om de instructies voor de AI te genereren ---
function createUnifiedPrompt(url) {
    return `Je bent 'OccasionCheck AI', een expert in het analyseren van auto-advertenties. Je antwoordt ALTIJD en UITSLUITEND met een JSON-object. Geef GEEN extra tekst zoals '\`\`\`json' voor of na het object.

    **URL:** ${url}

    **PROTOCOL:**
    1.  **ONDERZOEK URL:** Bezoek de URL met je 'google_search_retrieval' tool. Analyseer de volledige HTML-broncode. Is het een leesbare auto-advertentie?
    2.  **KIES MODUS:**
        * **SPECIFIEKE ANALYSE:** Als de pagina leesbaar is. Zet 'isSpecificAdAnalysis' op 'true'. Haal data direct van de pagina.
        * **ALGEMENE ANALYSE:** Als de pagina niet bruikbaar is (fout/blokkade). Zet 'isSpecificAdAnalysis' op 'false'. Gebruik je algemene kennis over het model uit de URL.
    3.  **VOER UIT:** Genereer het JSON-object volgens de gekozen modus en de onderstaande structuur.

    **TECHNISCHE HINTS VOOR HTML-ANALYSE (VOLG DEZE PRIORITEITEN):**
    Jouw primaire taak is om de HTML-structuur te analyseren.
    
    - **Prijs (price):**
        1.  **PRIORITEIT 1 (Class-based):** Zoek EERST naar HTML-elementen (<span>, <div>) met een 'class' attribuut dat 'Price', 'price', 'amount', of 'prijs' bevat. Dit is de meest betrouwbare bron.
        2.  **PRIORITEIT 2 (Text-based):** ALS methode 1 mislukt, zoek dan naar de meest prominente vraagprijs in de tekst, vaak in het formaat '€ 34.890,-' en dicht bij de titel.
        3.  Converteer de gevonden prijs naar een getal (bv. 34890).

    - **Kilometerstand (specs):**
        1.  **PRIORITEIT 1 (Class-based):** Zoek EERST naar elementen met een 'class' die 'km', 'mileage', 'kilometerstand', of 'kenmerk-kilometerstand' bevat.
        2.  **PRIORITEIT 2 (Text-based):** ALS methode 1 mislukt, zoek dan naar de tekst 'KM stand' of 'Kilometerstand' en neem het getal dat er direct naast staat.

    - **Titel:** De titel staat bijna altijd in de \`<h1>\` tag.
    - **Specificaties:** Zoek naar een \`<ul>\` of \`<table>\` met 'specs', 'kenmerken', of 'specifications' in de class.
    
    **GEEF NU EEN GELDIG JSON-OBJECT TERUG MET DEZE STRUCTURUR:**
    {
      "isSpecificAdAnalysis": true,
      "title": "...",
      "photos": ["url1", "url2", "url3", "url4"],
      "marketAnalysis": "...",
      "price": 12345,
      "specs": { "Merk": "...", "Model": "...", "Bouwjaar": "...", "Kilometerstand": "...", "Brandstof": "...", "Transmissie": "..." },
      "pluspunten": ["..."],
      "minpunten": ["..."],
      "onderhandelingsadvies": "...",
      "eindconclusie": "...",
      "score": 8.5
    }
    `;
}

// --- De hoofd export, de functie die Vercel zal aanroepen ---
module.exports = async (req, res) => {
    try {
        // Stap 1: Controleer de API sleutel direct.
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("FATALE FOUT: GEMINI_API_KEY is niet gevonden in de serveromgeving.");
            throw new Error("API sleutel is niet geconfigureerd op de server.");
        }
        
        // Initialiseer de client. Als dit mislukt, wordt het nu opgevangen.
        const genAI = new GoogleGenerativeAI(apiKey);

        const targetUrl = req.query.url;
        if (!targetUrl) {
            return res.status(400).json({ error: 'Geen URL meegegeven.' });
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest",
        });

        const prompt = createUnifiedPrompt(targetUrl);

        const result = await model.generateContent({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ "google_search_retrieval": {} }],
        });
        
        const responseText = result.response.text();
        
        const jsonStartIndex = responseText.indexOf('{');
        const jsonEndIndex = responseText.lastIndexOf('}');

        if (jsonStartIndex === -1 || jsonEndIndex === -1) {
            console.error('AI-antwoord bevatte geen JSON:', responseText);
            throw new Error('De AI gaf een onverwacht antwoord dat geen JSON-data bevatte.');
        }

        const jsonString = responseText.substring(jsonStartIndex, jsonEndIndex + 1);
        const analysisData = JSON.parse(jsonString);

        res.status(200).json(analysisData);

    } catch (error) {
        // Deze catch-block vangt nu ALLES op, inclusief initialisatiefouten.
        console.error('Fout opgevangen in de hoofdfunctie:', error);
        res.status(500).json({
            error: error.message || "Er is een onbekende serverfout opgetreden."
        });
    }
};

