module.exports = async (req, res) => {
    // Haal de API sleutel op uit de serveromgeving van Vercel
    const apiKey = process.env.GEMINI_API_KEY;

    // Controleer of de sleutel bestaat en niet leeg is
    const apiKeyFound = !!apiKey;

    // Stuur een simpel JSON object terug naar de website.
    // Dit laat ons direct zien of de sleutel is gevonden.
    res.status(200).json({
        title: "Diagnostische Test Resultaten",
        price: 123,
        specs: {
            "Test Status": "Succesvol uitgevoerd",
            "API Sleutel Gevonden": apiKeyFound ? "Ja" : "Nee",
            "Sleutel Preview": apiKey ? `Eindigt op ...${apiKey.slice(-4)}` : "Niet gevonden"
        },
        photos: [],
        pluspunten: ["Dit is een test om de serverfunctie te controleren."],
        minpunten: ["Als je dit ziet, werkt de basis van de server."],
        onderhandelingsadvies: ["De volgende stap is het analyseren van het resultaat."],
        eindconclusie: "De serverfunctie wordt succesvol uitgevoerd.",
        score: 10
    });
};