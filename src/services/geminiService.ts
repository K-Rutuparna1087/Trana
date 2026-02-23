import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const getRiskIntelligence = async (location: string, history: any[]) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following emergency incident history for ${location} and provide a risk intelligence report in JSON format.
    History: ${JSON.stringify(history)}
    Include:
    - High-risk zones (coordinates)
    - Peak risk hours
    - Suggested preventive measures
    - Predicted anomaly likelihood (0-100)`,
    config: {
      responseMimeType: "application/json"
    }
  });
  return JSON.parse(response.text || '{}');
};
