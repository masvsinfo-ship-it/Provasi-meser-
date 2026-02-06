
import { GoogleGenAI, Type } from "@google/genai";
import { MessSummary } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async getSmartInsight(summary: MessSummary) {
    if (!process.env.API_KEY) return "AI Insights unavailable.";

    const prompt = `
      Analyze this Mess (Shared Apartment) financial status and give a friendly, 1-2 sentence advice in BENGALI.
      The mess follows a "Total Bill" system (No advance pool).
      Total Mess Market Expense: SR ${summary.totalSharedExpense.toFixed(2)}
      Each member's shared share: SR ${summary.averagePerPerson.toFixed(2)}
      
      Member Total Costs (Shared Share + Personal items):
      ${summary.memberBalances.map(b => `- ${b.member.name}: Total Cost SR ${b.netBalance.toFixed(2)} (Personal: SR ${b.personalTotal.toFixed(2)})`).join('\n')}
      
      Advice should be in Bengali. Mention if personal costs are high or general mess advice.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
      return response.text || "হিসাব ঠিক আছে।";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "হিসাব চেক করা যাচ্ছে না।";
    }
  }
}

export const geminiService = new GeminiService();
