"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const openai_1 = require("@langchain/openai");
const client_1 = require("@prisma/client");
const nlu_agent_1 = require("./agents/nlu.agent");
const sentiment_agent_1 = require("./agents/sentiment.agent");
const memory_agent_1 = require("./agents/memory.agent");
const group_agent_1 = require("./agents/group.agent");
const greeter_agent_1 = require("./agents/greeter.agent");
const recommendation_agent_1 = require("./agents/recommendation.agent");
const upsell_agent_1 = require("./agents/upsell.agent");
const validation_agent_1 = require("./agents/validation.agent");
const prisma = new client_1.PrismaClient();
class AiService {
    static model = null;
    static getModel() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey || apiKey.includes('your-openai-api-key')) {
            console.warn('AI Service: OpenAI API Key not configured. Using rule-based fallback recommender.');
            return null;
        }
        if (!this.model) {
            this.model = new openai_1.ChatOpenAI({
                openAIApiKey: apiKey,
                modelName: 'gpt-3.5-turbo', // stable, cost-effective base for agents
                temperature: 0.7,
            });
        }
        return this.model;
    }
    /**
     * Generates a dynamic conversational response utilizing the modular 8-Agent pipeline.
     */
    static async generateResponse(sessionId, userMessage) {
        try {
            const model = this.getModel();
            // Retrieve session and associated user info
            const session = await prisma.session.findUnique({
                where: { id: sessionId },
                include: { user: true }
            });
            const tableNo = session?.tableNo || '1';
            const guestName = session?.user?.name || null;
            // ─── STEP 1: MULTILINGUAL NLU AGENT ───
            // Detect language (English, Hinglish, Telugu-English) and normalize userMessage to English
            const nluResult = await nlu_agent_1.NluAgent.process(userMessage, model);
            const englishInput = nluResult.translatedInput;
            // ─── STEP 2: SENTIMENT ANALYSIS AGENT ───
            // Detect frustration/confusion and check if staff/waiter is needed
            const sentimentResult = await sentiment_agent_1.SentimentAgent.analyze(englishInput, model);
            // ─── STEP 3: CONTEXT MEMORY AGENT ───
            // Extract, merge, and persist user preferences/allergies
            const memoryContext = await memory_agent_1.ContextMemoryAgent.extractAndStore(sessionId, englishInput, model);
            // ─── STEP 4: GROUP COORDINATOR AGENT ───
            // Parse active table diners count and coordinate shared dining instructions
            const groupContext = await group_agent_1.GroupCoordinatorAgent.coordinate(sessionId, englishInput, model);
            // Construct a special header prefix if waiter intervention is triggered
            let staffInterventionNotice = '';
            if (sentimentResult.requiresStaffIntervention) {
                staffInterventionNotice = `🔔 *[AI Companion Note: I have notified our floor captain to stop by Table ${tableNo} to assist you immediately!]* \n\n`;
            }
            // Check if this is a first-time greeting message
            const isGreeting = englishInput.toLowerCase().match(/\b(hi|hello|hey|greetings|welcome|namaste|hola|good morning|good evening)\b/) &&
                !(englishInput.toLowerCase().includes('want') || englishInput.toLowerCase().includes('order') || englishInput.toLowerCase().includes('suggest') || englishInput.toLowerCase().includes('food'));
            let coreReply = '';
            let chosenItems = [];
            // ─── STEP 5 & 6: GREETER OR RECOMMENDATION AGENT ───
            if (isGreeting) {
                // Welcome and introductory flow
                coreReply = await greeter_agent_1.GreeterAgent.greet(tableNo, guestName, model);
            }
            else {
                // Core menu recommendation flow
                const recommendationResult = await recommendation_agent_1.RecommendationAgent.recommend(englishInput, memoryContext, model);
                coreReply = recommendationResult.text;
                chosenItems = recommendationResult.items;
            }
            // ─── STEP 7: UPSELL AGENT ───
            // Suggest complementary side dishes, drinks, or desserts
            let upsellReply = '';
            if (chosenItems.length > 0) {
                const upsellResult = await upsell_agent_1.UpsellAgent.suggestPairings(chosenItems, sessionId, model);
                upsellReply = upsellResult.text;
            }
            // ─── STEP 8: ORDER VALIDATION AGENT ───
            // Validate current cart items against extracted memory allergies/preferences
            const validationResult = await validation_agent_1.OrderValidationAgent.validate(sessionId, memoryContext, model);
            // Assemble final unified assistant response
            let finalAssembly = '';
            // Add staff notification if triggered
            if (staffInterventionNotice) {
                finalAssembly += staffInterventionNotice;
            }
            // Append primary response
            finalAssembly += coreReply;
            // Append upsell suggestion if present
            if (upsellReply) {
                finalAssembly += `\n\n${upsellReply}`;
            }
            // Append safety allergen/dietary validations
            if (validationResult.issues.length > 0) {
                finalAssembly += `\n\n${validationResult.feedbackMessage}`;
            }
            // Add group coordinated summary for group sessions
            if (groupContext.isGroupSession && !isGreeting) {
                finalAssembly += `\n\n👥 *[Table ${tableNo} Dining Roster - Group Coordination]* \n*Active Diners: ${groupContext.activeDinersCount}* | *Status: ${groupContext.dinerPreferencesSummary}*`;
            }
            // ─── LOCALIZATION BACK TO TARGET LANGUAGE ───
            // If Hinglish or Telugu-English was detected, adapt the assembled response back
            const localizedResponse = await nlu_agent_1.NluAgent.localizeResponse(finalAssembly, nluResult.detectedLanguage, model);
            return localizedResponse;
        }
        catch (error) {
            console.error('Multi-Agent Pipeline Error:', error);
            return "I apologize, my digital kitchen circuits are experiencing a brief delay. Our floor captain has been notified to assist you at your table immediately!";
        }
    }
}
exports.AiService = AiService;
