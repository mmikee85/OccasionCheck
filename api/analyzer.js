// Importeer de officiële Google AI package
const { GoogleGenerativeAI } = require('@google-generative-ai');

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
            Je bent een hypernauwkeurige Nederlandse auto-data-extractor. Jouw enige taak is het analyseren van EEN SPECIFIEKE URL en het teruggeven van een 100% correct JSON-object. Nauwkeurigheid is het allerbelangrijkste. Het is beter om een fout te retourneren dan onjuiste data.
            WIJK NOOIT AF VAN DIT JSON-FORMAAT. GEEF ALLEEN HET JSON-OBJECT TERUG.

            **BELANGRIJKE FOUTAFHANDELING:** Als je de URL om welke reden dan ook niet kunt openen, analyseren, of als de pagina geen autoadvertentie is, geef dan **ALTIJD** het volgende JSON-object terug:
            {
              "error": "De opgegeven URL kon niet worden geanalyseerd. Controleer of de link correct is en de pagina openbaar toegankelijk is."
            }
            
            Als de analyse wel lukt, moet het JSON-object de volgende structuur hebben:
            {
              "title": "string", "price": number, "photos": ["url1", "url2", "url3", "url4"],
              "specs": { "key1": "value1", "key2": "value2" }, "pluspunten": ["string"],
              "minpunten": ["string"], "onderhandelingsadvies": ["string"],
              "eindconclusie": "string", "score": number, "marketAnalysis": "string"
            }
            Gebruik de GOOGLE_SEARCH tool om de opgegeven URL te bezoeken en alle benodigde informatie te verzamelen.
            
            **JE DENKPROCES IN STAPPEN (VOLG DIT VERPLICHT):**
            1.  **STAP 1: IDENTIFICATIE.** Bezoek de URL en identificeer het hoofdvoertuig van de advertentie. Noteer de titel, de vraagprijs en de kilometerstand.
            2.  **STAP 2: VERIFICATIE (EXTREEM BELANGRIJK).** Controleer nu je gevonden data. Komt de prijs en kilometerstand daadwerkelijk uit het hoofdonderdeel van de advertentie, of heb je het per ongeluk uit een 'vergelijkbare advertenties' sectie gehaald? Pas je data aan als dit nodig is. De correcte prijs staat meestal direct onder de titel en is prominent aanwezig. Het is vaak geformatteerd als '€ 34.890,-'. Herken dit, en converteer het naar een getal (bv. 34890).
            3.  **STAP 3: CONCLUSIE.** NADAT je de correcte data hebt geverifieerd in stap 2, vul je het JSON-object in. Vergelijk de geverifieerde prijs met de marktwaarde en schrijf je conclusie in 'marketAnalysis'.
            
            **AANVULLENDE REGELS:**
            - **Analyseer UITSLUITEND de content van de opgegeven URL.** - **Foto's (photos):** Zoek de EERSTE VIER hoofdafbeeldingen van de auto. De URLs MOETEN compleet en absoluut zijn (beginnend met http of https). FALLBACK: Gebruik 'placehold.co' URLs als je geen echte foto's kunt vinden.
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

