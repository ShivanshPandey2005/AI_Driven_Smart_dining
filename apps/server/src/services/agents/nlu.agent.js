"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NluAgent = void 0;
const prompts_1 = require("@langchain/core/prompts");
class NluAgent {
    /**
     * Processes raw input to detect language and normalize it to English.
     */
    static async process(input, model) {
        const cleanInput = input.trim();
        if (!cleanInput) {
            return { detectedLanguage: 'English', translatedInput: '', originalInput: '' };
        }
        if (model) {
            try {
                const prompt = prompts_1.ChatPromptTemplate.fromMessages([
                    ['system', `You are the Multilingual NLU Agent for an elite Indian restaurant.
Analyze the user's input.
1. Detect if the language is "English", "Hinglish" (Hindi mixed with English), or "Telugu-English" (Telugu mixed with English).
2. Translate the message into clean, standard English for our internal kitchen/recommendation agents. Preserve the exact culinary intent, spice preference, and mood.

Response format MUST be raw JSON:
{
  "detectedLanguage": "English" | "Hinglish" | "Telugu-English" | "Other",
  "translatedInput": "Translated English text"
}`],
                    ['user', '{input}'],
                ]);
                const chain = prompt.pipe(model);
                const response = await chain.invoke({ input: cleanInput });
                let text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
                // Clean JSON if wrapped in markdown
                text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(text);
                return {
                    detectedLanguage: parsed.detectedLanguage || 'English',
                    translatedInput: parsed.translatedInput || cleanInput,
                    originalInput: cleanInput,
                };
            }
            catch (err) {
                console.error('NLU Agent API Error, using fallback:', err);
            }
        }
        // High-fidelity fallback regex rules
        return this.fallbackNlu(cleanInput);
    }
    static fallbackNlu(input) {
        const lower = input.toLowerCase();
        // Simple checks for Hinglish patterns
        const hinglishKeywords = [
            'chahiye', 'karo', 'kya', 'meetha', 'teekha', 'khana', 'batao', 'paneer', 'roti', 'sabzi',
            'dijiye', 'hai', 'bhai', 'yaar', 'swad', 'achha', 'swadisht', 'biryani milegi'
        ];
        // Simple checks for Telugu-English patterns
        const teluguKeywords = [
            'bagundi', 'emundi', 'kavali', 'tinalani', 'cheppandi', 'naku', 'chala', 'thagginchandi',
            'ekkuva', 'bhojanam', 'tinna', 'avunu', 'kadhā', 'ra'
        ];
        let detectedLanguage = 'English';
        let translatedInput = input;
        const hinglishMatch = hinglishKeywords.some(kw => lower.includes(kw));
        const teluguMatch = teluguKeywords.some(kw => lower.includes(kw));
        if (teluguMatch) {
            detectedLanguage = 'Telugu-English';
            // Fallback translation mapping for demo excellence
            if (lower.includes('kavali') || lower.includes('tinalani')) {
                translatedInput = `I want to eat: ${input}`;
            }
            if (lower.includes('bagundi')) {
                translatedInput = `It is good: ${input}`;
            }
            if (lower.includes('cheppandi')) {
                translatedInput = `Please tell me: ${input}`;
            }
            if (lower.includes('spice') || lower.includes('khara') || lower.includes('thagginchandi')) {
                translatedInput = `Reduce the spice level: ${input}`;
            }
        }
        else if (hinglishMatch) {
            detectedLanguage = 'Hinglish';
            // Fallback translation mapping
            if (lower.includes('meetha') || lower.includes('sweet')) {
                translatedInput = `Suggest something sweet / dessert: ${input}`;
            }
            else if (lower.includes('teekha') || lower.includes('spicy')) {
                translatedInput = `Suggest something spicy: ${input}`;
            }
            else if (lower.includes('batao') || lower.includes('suggest')) {
                translatedInput = `Tell me / suggest food: ${input}`;
            }
            else if (lower.includes('chahiye')) {
                translatedInput = `I want to order / have: ${input}`;
            }
        }
        return {
            detectedLanguage,
            translatedInput,
            originalInput: input,
        };
    }
    /**
     * Localizes/translates response back to NLU target language if requested.
     */
    static async localizeResponse(response, targetLang, model) {
        if (targetLang === 'English' || targetLang === 'Other' || !model) {
            return response; // No translation needed or fallback default is English
        }
        try {
            const prompt = prompts_1.ChatPromptTemplate.fromMessages([
                ['system', `You are the Multilingual Response Localizer for our restaurant.
Translate or adapt the provided English fine dining recommendation to match the target language style.
Target Language Style: ${targetLang}

Rules:
1. For Hinglish: Maintain the premium feel, but explain details using casual Hindi-English blend (e.g., "Aapke liye Humne Dal Bukhara pick kiya hai, which is super creamy!"). Keep dish names in English.
2. For Telugu-English: Maintain premium tone, using a charming Telugu-English blend (e.g., "Naku telusu meeru enjoy chestharu Dal Bukhara! It is slow-cooked for 24 hours, chala rich and delicious!").
3. Make sure the pricing and core allergens remain extremely accurate. Do not alter prices.
Return only the translated/adapted response.`],
                ['user', 'Target Language: {targetLang}\nEnglish Text:\n{text}'],
            ]);
            const chain = prompt.pipe(model);
            const output = await chain.invoke({
                targetLang,
                text: response,
            });
            return typeof output.content === 'string' ? output.content : JSON.stringify(output.content);
        }
        catch (err) {
            console.error('Response localization error, returning English:', err);
            return response;
        }
    }
}
exports.NluAgent = NluAgent;
