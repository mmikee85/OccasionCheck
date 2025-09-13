// Importeer de officiële Google AI package
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialiseer de Gemini client met de API sleutel die we later in Vercel instellen
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Dit is de hoofd export, de functie die Vercel zal aanroepen
module.exports = async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'Geen URL meegegeven.' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const systemPrompt = `
            Je bent een deskundige en onafhankelijke Nederlandse auto-expert.
            Je hoofddoel is om een URL van een autoadvertentie te analyseren en een compleet, gestructureerd JSON-object terug te geven.
            WIJK NOOIT AF VAN DIT JSON-FORMAAT. ZELFS NIET BIJ EEN FOUT.
            Het JSON-object moet de volgende structuur hebben:
            {
              "title": "string", "price": number, "photos": ["url1", "url2", "url3", "url4"],
              "specs": { "key1": "value1", "key2": "value2" }, "pluspunten": ["string"],
              "minpunten": ["string"], "onderhandelingsadvies": ["string"],
              "eindconclusie": "string", "score": number
            }
            Gebruik de GOOGLE_SEARCH tool om de opgegeven URL te bezoeken en alle benodigde informatie te verzamelen.
            - Prijs (price): Geef dit terug als een getal (number), zonder valutasymbolen of punten.
            - Foto's (photos): Haal de URLs van de eerste 4 hoofdafbeeldingen op.
            - Specificaties (specs): Verzamel de belangrijkste specificaties zoals bouwjaar, kilometerstand, etc.
            - Analyse: Bepaal op basis van alle informatie de plus- en minpunten, advies, conclusie en een score van 0.0 tot 10.0.
            Als je een veld niet kunt vinden, geef dan een logische standaardwaarde terug (bv. 0 voor prijs, een lege array []).
        `;
        
        const userPrompt = `Analyseer de advertentie op de volgende URL: ${targetUrl}`;

        const chat = model.startChat({
            systemInstruction: systemPrompt,
            tools: [{ "google_search": {} }]
        });
        
        const result = await chat.sendMessage(userPrompt);
        const responseText = result.response.text();
        
        const cleanedJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysisData = JSON.parse(cleanedJsonString);
        
        res.status(200).json(analysisData);

    } catch (error) {
        console.error('Fout tijdens de Gemini analyse:', error);
        res.status(500).json({ error: 'Er is iets misgegaan bij het analyseren van de link.', details: error.message });
    }
};

