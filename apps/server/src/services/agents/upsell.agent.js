"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpsellAgent = void 0;
const prompts_1 = require("@langchain/core/prompts");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class UpsellAgent {
    /**
     * Recommends complementary drinks, sides, or combos.
     */
    static async suggestPairings(recommendedItems, sessionId, model) {
        let allItems = [];
        try {
            allItems = await prisma.menuItem.findMany({
                where: { available: true }
            });
        }
        catch (err) {
            console.warn('Upsell Agent: Failed to fetch items:', err);
        }
        // 1. Gather all unique complementary item names from recommended items
        const pairingNames = new Set();
        recommendedItems.forEach(item => {
            if (item.complementaryItems) {
                item.complementaryItems.forEach(p => pairingNames.add(p.toLowerCase()));
            }
        });
        // 2. Filter available items that match pairings or are high-popularity drinks/desserts
        let upsellCandidates = allItems.filter(item => pairingNames.has(item.name.toLowerCase()) ||
            item.category.toLowerCase() === 'beverages' ||
            item.category.toLowerCase() === 'desserts');
        // Filter out items already in the recommended list to avoid redundancy
        const recIds = new Set(recommendedItems.map(r => r.id));
        upsellCandidates = upsellCandidates.filter(item => !recIds.has(item.id));
        // Sort candidates by popularity score
        upsellCandidates.sort((a, b) => b.popularScore - a.popularScore);
        const topUpsellCandidates = upsellCandidates.slice(0, 3);
        if (model && topUpsellCandidates.length > 0) {
            try {
                const primaryNames = recommendedItems.map(r => r.name).join(', ');
                const candidatesText = topUpsellCandidates.map(c => `ID: ${c.id} | Name: "${c.name}" | Category: ${c.category} | Price: ₹${c.price} | Description: ${c.description}`).join('\n');
                const prompt = prompts_1.ChatPromptTemplate.fromMessages([
                    ['system', `You are the Upsell Agent for "Antigravity Chef".
Your goal is to suggest a single, perfect complementary pairing (beverage, side, or dessert) for the selected primary items: [{primaryNames}].
Make it sound irresistible, explaining why this drink or side completes the flavor profile perfectly.

Available Complementary Candidates:
${candidatesText}

Response format MUST be raw JSON:
{{
  "responseText": "Irresistible description of the pairing...",
  "selectedUpsellId": "ID of the selected upsell item"
}}`],
                    ['user', 'Select and describe the best pairing.'],
                ]);
                const chain = prompt.pipe(model);
                const response = await chain.invoke({
                    primaryNames,
                });
                let text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
                text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(text);
                const chosenItem = topUpsellCandidates.find(c => c.id === parsed.selectedUpsellId);
                return {
                    text: parsed.responseText || 'Complement your meal with a perfect beverage or dessert!',
                    upsellItems: chosenItem ? [chosenItem] : [topUpsellCandidates[0]],
                };
            }
            catch (err) {
                console.error('Upsell Agent API error, running offline fallback:', err);
            }
        }
        // High fidelity offline fallback
        if (topUpsellCandidates.length > 0) {
            const match = topUpsellCandidates[0];
            return {
                text: `To elevate your dining experience, I highly recommend pairing these selections with our cooling **${match.name}** (₹${match.price}) - *${match.description}*! It creates a truly harmonious blend of flavors.`,
                upsellItems: [match],
            };
        }
        return {
            text: '',
            upsellItems: [],
        };
    }
}
exports.UpsellAgent = UpsellAgent;
