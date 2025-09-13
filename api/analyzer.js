// Importeer de officiële Google AI package
const { GoogleGenerativeAI } = require('@google-generative-ai');

// Initialiseer de Gemini client met de API sleutel die we later in Vercel instellen
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Functie om de instructies voor de AI te genereren
function createUnifiedPrompt(url) {
    return `Je bent 'OccasionCheck AI', een expert in het analyseren van auto-advertenties. Je antwoordt ALTIJD met een JSON-object. Geef GEEN extra tekst voor of na het JSON-object.

    **URL van de te analyseren advertentie:** ${url}

    **PROTOCOL (VOLG DEZE STAPPEN PRECIES):**

    1.  **ONDERZOEK DE URL**: Gebruik je 'google_search_retrieval' tool om de webpagina op de URL te bezoeken en te lezen. Bepaal of de inhoud een valide, leesbare auto-advertentie is.
    
    2.  **KIES JE MODUS**:
        * **Als de pagina een valide, leesbare advertentie bevat**: Voer een **SPECIFIEKE ANALYSE** uit. Zet 'isSpecificAdAnalysis' op 'true'. Baseer je antwoorden op de data die je **direct van de pagina** haalt.
        * **Als de pagina NIET bruikbaar is (bv. een fout, blokkade, of geen advertentie)**: Voer een **ALGEMENE FALLBACK ANALYSE** uit. Zet 'isSpecificAdAnalysis' op 'false'. Baseer je antwoorden op je algemene kennis over het automodel dat waarschijnlijk in de URL wordt genoemd.

    **INSTRUCTIES VOOR SPECIFIEKE ANALYSE (isSpecificAdAnalysis: true)**
    * **price**: Vind de **exacte vraagprijs** op de pagina en converteer dit naar een getal.
    * **specs**: Haal waarden (vooral kilometerstand) **direct van de pagina**.
    * **Analyse**: Baseer alle tekstuele analyses (pluspunten, minpunten, advies, etc.) op de specifieke details van de advertentie.
    * **score**: Beoordeel de **specifieke deal** uit de advertentie.

    **INSTRUCTIES VOOR ALGEMENE FALLBACK ANALYSE (isSpecificAdAnalysis: false)**
    * **price**: Maak een realistische **schatting** voor dit model en bouwjaar.
    * **specs**: Gebruik **algemene** data voor dit model.
    * **Analyse**: Schrijf **algemene** teksten over het model.
    * **score**: Beoordeel het **model in het algemeen** als occasion.

    ---
    **VOER NU DE GEKOZEN ANALYSE UIT EN GEEF EEN GELDIG JSON-OBJECT TERUG MET DE VOLGENDE STRUCTUUR:**
    \`\`\`json
    {
      "isSpecificAdAnalysis": true,
      "title": "Voorbeeld Titel",
      "photos": ["url1", "url2", "url3", "url4"],
      "marketAnalysis": "Voorbeeld marktanalyse.",
      "price": 12345,
      "specs": {
        "Merk": "Voorbeeld Merk",
        "Model": "Voorbeeld Model",
        "Bouwjaar": "2020",
        "Kilometerstand": "12345 km",
        "Brandstof": "Benzine",
        "Transmissie": "Automaat"
      },
      "pluspunten": ["Voorbeeld pluspunt 1"],
      "minpunten": ["Voorbeeld minpunt 1"],
      "onderhandelingsadvies": "Voorbeeld onderhandelingsadvies.",
      "eindconclusie": "Voorbeeld eindconclusie.",
      "score": 8.5
    }
    \`\`\`
    `;
}

// Dit is de hoofd export, de functie die Vercel zal aanroepen
module.exports = async (req, res) => {
    console.log("GEMINI_API_KEY gevonden:", !!process.env.GEMINI_API_KEY);
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'Geen URL meegegeven.' });
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest",
        });

        const prompt = createUnifiedPrompt(targetUrl);

        const result = await model.generateContent({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ "google_search_retrieval": {} }],
        });
        
        const responseText = result.response.text();
        
        // --- ROBUUSTE PARSING LOGICA (DE "SLIMME SCHAAR") ---
        const jsonStartIndex = responseText.indexOf('{');
        const jsonEndIndex = responseText.lastIndexOf('}');

        if (jsonStartIndex === -1 || jsonEndIndex === -1) {
            console.error('Geen geldig JSON-object gevonden in het AI-antwoord:', responseText);
            throw new Error('De AI gaf een onverwacht antwoord dat geen JSON-data bevatte.');
        }

        const jsonString = responseText.substring(jsonStartIndex, jsonEndIndex + 1);
        let analysisData;
        try {
            analysisData = JSON.parse(jsonString);
        } catch (parseError) {
             console.error('Fout bij het parsen van de uitgeknipte JSON:', parseError);
             console.error('Ontvangen (corrupte JSON) tekst van Gemini:', jsonString);
             throw new Error('De AI gaf een onverwacht antwoord en de data kon niet worden gelezen.');
        }

        res.status(200).json(analysisData);

    } catch (error) {
        console.error('Fout tijdens de volledige analyse:', error);
        res.status(500).json({
            error: error.message || "Er is een onbekende fout opgetreden bij de AI-analyse."
        });
    }
};

