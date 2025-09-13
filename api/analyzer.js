// Importeer de officiële Google AI package
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Functie om de instructies voor de AI te genereren ---
function createUnifiedPrompt(url) {
    return `Je bent 'OccasionCheck AI', een expert in het analyseren van auto-advertenties. Je antwoordt ALTIJD en UITSLUITEND met een JSON-object. Geef GEEN extra tekst zoals '\`\`\`json' voor of na het object.

    **URL:** ${url}

    **PROTOCOL:**
    1.  **ONDERZOEK URL:** Bezoek de URL met je 'google_search_retrieval' tool. Analyseer de HTML-broncode. Is het een leesbare auto-advertentie?
    2.  **KIES MODUS:**
        * **SPECIFIEKE ANALYSE:** Als de pagina leesbaar is. Zet 'isSpecificAdAnalysis' op 'true'. Haal data direct van de pagina.
        * **ALGEMENE ANALYSE:** Als de pagina niet bruikbaar is (fout/blokkade). Zet 'isSpecificAdAnalysis' op 'false'. Gebruik je algemene kennis over het model uit de URL.
    3.  **VOER UIT:** Genereer het JSON-object volgens de gekozen modus en de onderstaande structuur.

    **BELANGRIJKSTE REGELS VOOR DATA-EXTRACTIE:**
    - **Prijs (price):** Dit is de meest kritische waarde. Volg dit stappenplan om de VRAAGPRIJS te vinden:
        1.  **STAP 1 (Analyseer HTML Class):** Scan de HTML voor elementen (zoals <span> of <div>) met een 'class' attribuut dat "price", "prijs", of "amount" bevat. Dit is de meest betrouwbare bron.
        2.  **STAP 2 (Zoek naar Labels):** Als stap 1 niets oplevert, zoek dan naar de tekst "Prijs" of "Vraagprijs" en neem het getal dat er direct naast of onder staat.
        3.  **STAP 3 (Positie-analyse):** Als stap 1 en 2 mislukken, zoek dan naar het meest prominente getal (groot lettertype, opvallende kleur) dat direct onder de hoofdtitel (de \`<h1>\` tag) staat.
        4.  **UITSLUITINGEN:** Negeer ALTIJD getallen die duidelijk bij een financiering, maandbedrag, of 'vergelijkbare advertenties' horen.
        5.  **FORMATTERING:** Converteer de gevonden prijs naar een getal (bv. 34890).
        
    - **Kilometerstand (specs):** Zoek naar een element met een 'class' die 'km', 'mileage' of 'kilometerstand' bevat. Als dat niet lukt, zoek dan naar de tekst 'KM stand' en neem het bijbehorende getal.
    - **Titel:** De titel staat bijna altijd in de \`<h1>\` tag.
    
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

