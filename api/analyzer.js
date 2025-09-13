// Importeer de officiële Google AI package
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialiseer de Gemini client met de API sleutel die we later in Vercel instellen
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Dit is de hoofd export, de functie die Vercel zal aanroepen
module.exports = async (req, res) => {
    // Dit logt of de API sleutel succesvol is ingeladen door de server.
    console.log("GEMINI_API_KEY gevonden:", !!process.env.GEMINI_API_KEY);

    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'Geen URL meegegeven.' });
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest"
        });

        const systemPrompt = `
            Je bent een deskundige en onafhankelijke Nederlandse auto-expert.
            Je hoofddoel is om een URL van een autoadvertentie te analyseren en een compleet, gestructureerd JSON-object terug te geven.
            WIJK NOOIT AF VAN DIT JSON-FORMAAT. GEEF ALLEEN HET JSON-OBJECT TERUG, ZONDER EXTRA TEKST OF MARKDOWN.

            **BELANGRIJKE FOUTAFHANDELING:** Als je de URL om welke reden dan ook niet kunt openen, analyseren, of als de pagina geen autoadvertentie is, geef dan **ALTIJD** het volgende JSON-object terug:
            {
              "error": "De opgegeven URL kon niet worden geanalyseerd. Controleer of de link correct is en de pagina openbaar toegankelijk is."
            }
            
            Als de analyse wel lukt, moet het JSON-object de volgende structuur hebben:
            {
              "title": "string", "price": number, "photos": ["url1", "url2", "url3", "url4"],
              "specs": { "key1": "value1", "key2": "value2" }, "pluspunten": ["string"],
              "minpunten": ["string"], "onderhandelingsadvies": ["string"],
              "eindconclusie": "string", "score": number
            }
            Gebruik de GOOGLE_SEARCH tool om de opgegeven URL te bezoeken en alle benodigde informatie te verzamelen.
            
            **ZEER SPECIFIEKE INSTRUCTIES:**
            - **Prijs (price):** Zoek specifiek naar de VRAAGPRIJS. Negeer andere getallen zoals maandbedragen. Geef dit terug als een getal (number), zonder valutasymbolen of punten.
            - **Foto's (photos):** Zoek de EERSTE VIER hoofdafbeeldingen van de auto. Zorg ervoor dat de URLs compleet en absoluut zijn (beginnend met http of https). 
              **FALLBACK:** Als je geen geldige, complete foto-URL's kunt vinden, geef dan een array terug met vier placeholder URLs van 'placehold.co', bijvoorbeeld: ["https://placehold.co/600x400/333/FFF?text=Foto+1", "https://placehold.co/600x400/333/FFF?text=Foto+2", "https://placehold.co/600x400/333/FFF?text=Foto+3", "https://placehold.co/600x400/333/FFF?text=Foto+4"].
            - **Specificaties (specs):** Verzamel de belangrijkste specificaties zoals bouwjaar, kilometerstand, brandstof, transmissie etc.
            - **Analyse:** Bepaal op basis van alle informatie de plus- en minpunten, advies, conclusie en een score van 0.0 tot 10.0.
            Als je een veld niet kunt vinden, geef dan een logische standaardwaarde terug (bv. 0 voor prijs, een lege array [] voor lijsten).
        `;

        const userPrompt = `Analyseer de advertentie op de volgende URL: ${targetUrl}`;

        const chat = model.startChat({
            systemInstruction: {
                parts: [{
                    text: systemPrompt
                }],
            },
            tools: [{
                "google_search_retrieval": {}
            }]
        });

        const result = await chat.sendMessage(userPrompt);
        const responseText = result.response.text();

        let analysisData;
        
        // --- ROBUUSTE PARSING LOGICA ---
        const jsonStartIndex = responseText.indexOf('{');
        const jsonEndIndex = responseText.lastIndexOf('}');

        if (jsonStartIndex === -1 || jsonEndIndex === -1) {
            console.error('Geen geldig JSON-object gevonden in het AI-antwoord:', responseText);
            throw new Error('De AI gaf een onverwacht antwoord dat geen JSON-data bevatte.');
        }

        const jsonString = responseText.substring(jsonStartIndex, jsonEndIndex + 1);

        try {
            analysisData = JSON.parse(jsonString);
            if (analysisData.error) {
                console.error('AI rapporteerde een analysefout:', analysisData.error);
                throw new Error(analysisData.error);
            }
        } catch (parseError) {
            console.error('Fout bij het parsen van de uitgeknipte JSON:', parseError);
            console.error('Ontvangen (corrupte JSON) tekst van Gemini:', jsonString);
            throw new Error('De AI gaf een onverwacht antwoord en de data kon niet worden gelezen.');
        }

        res.status(200).json(analysisData);
    } catch (error) {
        console.error('Fout tijdens de volledige analyse:', error);
        res.status(500).json({
            error: error.message
        });
    }
};

