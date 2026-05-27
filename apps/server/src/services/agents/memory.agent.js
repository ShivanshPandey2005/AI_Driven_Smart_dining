"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextMemoryAgent = void 0;
const prompts_1 = require("@langchain/core/prompts");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class ContextMemoryAgent {
    /**
     * Loads existing preference context for a dining session.
     */
    static async getContext(sessionId) {
        try {
            const session = await prisma.session.findUnique({
                where: { id: sessionId },
            });
            if (session && session.preferences) {
                try {
                    const parsed = JSON.parse(session.preferences);
                    return {
                        preferences: parsed.preferences || [],
                        allergies: parsed.allergies || [],
                        budget: parsed.budget || 'unspecified',
                        spiceTolerance: parsed.spiceTolerance || 'unspecified',
                    };
                }
                catch (e) {
                    // If stored as simple text or failed JSON parsing
                    console.warn('Failed parsing session preference JSON, starting clean context.');
                }
            }
        }
        catch (err) {
            console.error('Failed fetching context from DB:', err);
        }
        return {
            preferences: [],
            allergies: [],
            budget: 'unspecified',
            spiceTolerance: 'unspecified',
        };
    }
    /**
     * Extracts preferences from a message and updates the session in the database.
     */
    static async extractAndStore(sessionId, message, model) {
        const currentContext = await this.getContext(sessionId);
        let extracted = {};
        if (model) {
            try {
                const prompt = prompts_1.ChatPromptTemplate.fromMessages([
                    ['system', `You are the Context Memory Agent for a premium restaurant.
Your task is to analyze the customer's message and extract preferences, allergies, budget, or spice tolerances.
Combine these with the client's current profile.

Current Client Profile:
${JSON.stringify(currentContext, null, 2)}

Extraction Guidelines:
- Preferences: Add tags like "vegetarian", "vegan", "non-veg", "healthy", "dessert lover", "likes chicken".
- Allergies: Add allergen tags strictly (e.g. "nuts", "dairy", "gluten", "peanuts", "seafood", "mustard"). Do not remove existing allergies unless the user explicitly corrects them (e.g., "Actually, I don't have a nut allergy").
- Budget: Classify as "low", "medium", "high" if they express budget boundaries (e.g. "Suggest something cheap", "Best expensive meal").
- Spice Tolerance: "mild" (or sweet), "medium", "spicy" (or hot) based on direct request.

Response format MUST be raw JSON:
{
  "preferences": ["tag1", "tag2"],
  "allergies": ["allergen1"],
  "budget": "low" | "medium" | "high" | "unspecified",
  "spiceTolerance": "mild" | "medium" | "spicy" | "unspecified"
}`],
                    ['user', '{message}'],
                ]);
                const chain = prompt.pipe(model);
                const response = await chain.invoke({ message });
                let text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
                text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                extracted = JSON.parse(text);
            }
            catch (err) {
                console.error('Memory Agent API Error, using offline extractor:', err);
                extracted = this.fallbackExtraction(message, currentContext);
            }
        }
        else {
            extracted = this.fallbackExtraction(message, currentContext);
        }
        // Merge & Deduplicate Context
        const mergedPreferences = Array.from(new Set([
            ...currentContext.preferences,
            ...(extracted.preferences || [])
        ]));
        const mergedAllergies = Array.from(new Set([
            ...currentContext.allergies,
            ...(extracted.allergies || [])
        ]));
        const mergedBudget = extracted.budget && extracted.budget !== 'unspecified'
            ? extracted.budget
            : currentContext.budget;
        const mergedSpice = extracted.spiceTolerance && extracted.spiceTolerance !== 'unspecified'
            ? extracted.spiceTolerance
            : currentContext.spiceTolerance;
        const newContext = {
            preferences: mergedPreferences,
            allergies: mergedAllergies,
            budget: mergedBudget,
            spiceTolerance: mergedSpice,
        };
        // Save back to DB
        try {
            await prisma.session.update({
                where: { id: sessionId },
                data: { preferences: JSON.stringify(newContext) }
            });
        }
        catch (err) {
            console.error('Failed saving updated memory context:', err);
        }
        return newContext;
    }
    static fallbackExtraction(message, current) {
        const lower = message.toLowerCase();
        const extracted = {
            preferences: [],
            allergies: [],
            budget: 'unspecified',
            spiceTolerance: 'unspecified',
        };
        // Allergies detection
        if (lower.includes('allergy') || lower.includes('allergic')) {
            if (lower.includes('nut') || lower.includes('peanut') || lower.includes('almond') || lower.includes('cashew')) {
                extracted.allergies?.push('nuts');
            }
            if (lower.includes('dairy') || lower.includes('milk') || lower.includes('lactose') || lower.includes('butter') || lower.includes('cheese')) {
                extracted.allergies?.push('dairy');
            }
            if (lower.includes('gluten') || lower.includes('wheat')) {
                extracted.allergies?.push('gluten');
            }
        }
        // Direct dietary checks
        if (lower.includes('veg') && !lower.includes('non-veg') && !lower.includes('nonveg')) {
            extracted.preferences?.push('vegetarian');
        }
        if (lower.includes('non-veg') || lower.includes('nonveg') || lower.includes('chicken') || lower.includes('lamb') || lower.includes('mutton') || lower.includes('meat')) {
            extracted.preferences?.push('non-vegetarian');
        }
        if (lower.includes('vegan')) {
            extracted.preferences?.push('vegan');
        }
        if (lower.includes('sweet') || lower.includes('dessert') || lower.includes('chocolate')) {
            extracted.preferences?.push('sweet tooth');
        }
        // Spice checks
        if (lower.includes('spicy') || lower.includes('teekha') || lower.includes('hot') || lower.includes('masaledar')) {
            extracted.spiceTolerance = 'spicy';
        }
        else if (lower.includes('mild') || lower.includes('less spicy') || lower.includes('sweet') || lower.includes('phika')) {
            extracted.spiceTolerance = 'mild';
        }
        else if (lower.includes('medium') || lower.includes('normal spice')) {
            extracted.spiceTolerance = 'medium';
        }
        // Budget checks
        if (lower.includes('cheap') || lower.includes('budget') || lower.includes('pocket friendly') || lower.includes('low price')) {
            extracted.budget = 'low';
        }
        else if (lower.includes('expensive') || lower.includes('premium') || lower.includes('best quality') || lower.includes('exquisite')) {
            extracted.budget = 'high';
        }
        return extracted;
    }
}
exports.ContextMemoryAgent = ContextMemoryAgent;
