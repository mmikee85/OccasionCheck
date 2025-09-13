// Importeer de officiële Google AI package
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialiseer de Gemini client met de API sleutel die we later in Vercel instellen
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Functie om de JSON-structuur te definiëren die we van de AI verwachten
function getResponseSchema() {
    return {
        type: "OBJECT",
        properties: {
            isSpecificAdAnalysis: {
                type: "BOOLEAN",
                description: "True als de analyse gebaseerd is op de specifieke advertentie, False als het een algemene fallback analyse is."
            },
            title: {
                type: "STRING",
                description: "De titel van de auto (bijv. 'BMW X3 xDrive20i High Executive M-Sport')."
            },
            photos: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "Een lijst met 4 URLs van de afbeeldingen. Als specifieke fotos niet lukken, representatieve afbeeldingen."
            },
            marketAnalysis: {
                type: "STRING",
                description: "Evaluatie van de vraagprijs (bijv. 'concurrerend', 'hoog', 'laag') en een korte uitleg."
            },
            price: {
                type: "NUMBER",
                description: "De exacte vraagprijs als getal. Als dit niet kan, een realistische schatting."
            },
            specs: {
                type: "OBJECT",
                description: "Een object met de belangrijkste specificaties.",
                properties: {
                    "Merk": { type: "STRING" },
                    "Model": { type: "STRING" },
                    "Bouwjaar": { type: "STRING" },
                    "Kilometerstand": { type: "STRING" },
                    "Brandstof": { type: "STRING" },
                    "Transmissie": { type: "STRING" },
                }
            },
            pluspunten: { type: "ARRAY", items: { type: "STRING" }, description: "Lijst van 3 sterkste algemene kanten van dit model." },
            minpunten: { type: "ARRAY", items: { type: "STRING" }, description: "Lijst van 3 meest voorkomende algemene problemen voor dit model." },
            onderhandelingsadvies: { type: "STRING", description: "Een concreet koop-onderhandelingsadvies." },
            eindconclusie: { type: "STRING", description: "De beredenering voor het gegeven cijfer." },
            score: { type: "NUMBER", description: "Een cijfer van 1.0 tot 10.0 voor deze specifieke deal of het model algemeen." },
        }
    };
}

// Functie om de instructies voor de AI te genereren
function createUnifiedPrompt(url) {
    return `Je bent 'OccasionCheck AI', een expert in het analyseren van auto-advertenties.

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
    **VOER NU DE GEKOZEN ANALYSE UIT EN VUL ALLE VELDEN IN VOLGENS HET JSON SCHEMA.**`;
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
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: getResponseSchema()
            }
        });
        
        const responseText = result.response.text();
        const analysisData = JSON.parse(responseText);

        res.status(200).json(analysisData);

    } catch (error) {
        console.error('Fout tijdens de volledige analyse:', error);
        res.status(500).json({
            error: error.message || "Er is een onbekende fout opgetreden bij de AI-analyse."
        });
    }
};

