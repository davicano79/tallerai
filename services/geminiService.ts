import { GoogleGenAI, Type } from "@google/genai";

// Helper to get API Key
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to clean LLM response that might be wrapped in markdown
const cleanAndParseJSON = (text: string) => {
  try {
    // Remove markdown code blocks if present (e.g. ```json ... ```)
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("Failed to parse JSON from Gemini:", text);
    throw new Error("La respuesta de la IA no tiene un formato válido.");
  }
};

// Function 1: Identify Car (License Plate, Make, Model)
// Uses gemini-3-pro-preview for high visual accuracy
export const identifyCarFromImage = async (base64Image: string) => {
  const ai = getAiClient();
  
  const prompt = `
    Analiza esta imagen de la parte trasera de un coche.
    1. Extrae la matrícula exactamente como aparece.
    2. Identifica la Marca y el Modelo del vehículo.
    3. Identifica el color principal.
    
    IMPORTANTE: Responde SIEMPRE en ESPAÑOL (ej: "Rojo", "Azul", "Gris").
    Devuelve el resultado en formato JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            plate: { type: Type.STRING, description: "Número de matrícula" },
            make: { type: Type.STRING, description: "Marca del fabricante" },
            model: { type: Type.STRING, description: "Modelo del coche" },
            color: { type: Type.STRING, description: "Color del coche en Español" }
          },
          required: ["plate", "make", "model"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return cleanAndParseJSON(text);
  } catch (error) {
    console.error("Error identifying car:", error);
    throw error;
  }
};

// Function 2: Analyze Damage
// Uses thinkingBudget for complex reasoning about parts and damage
export const analyzeDamageFromImage = async (base64Image: string) => {
  const ai = getAiClient();

  const prompt = `
    Eres un experto chapista y perito de taller mecánico en España. Analiza esta imagen de un vehículo dañado.
    Lista las piezas específicas de la carrocería que parecen estar dañadas.
    
    IMPORTANTE:
    1. Usa terminología técnica en ESPAÑOL de España (ej: "Parachoques", "Aleta", "Capó", "Faro", "Puerta", "Retrovisor").
    2. Sé preciso.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 32768 }, // High thinking budget for detailed analysis
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedParts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de piezas dañadas en Español"
            },
            assessment: {
              type: Type.STRING,
              description: "Breve evaluación técnica del daño (abolladura, arañazo, rotura) en Español"
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return cleanAndParseJSON(text);
  } catch (error) {
    console.error("Error analyzing damage:", error);
    throw error;
  }
};

// Function 3: Assistant Chat
// Supports Google Search for finding parts/specs
export const sendAssistantMessage = async (message: string, useSearch: boolean = false) => {
  const ai = getAiClient();
  
  const modelName = useSearch ? "gemini-2.5-flash" : "gemini-3-pro-preview";
  
  const tools = useSearch ? [{ googleSearch: {} }] : undefined;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: message,
      config: {
        tools: tools,
        systemInstruction: "Eres un asistente útil para un Taller de Chapa y Pintura en España. Ayudas a encontrar códigos de pintura, procedimientos de reparación y recambios. Responde siempre en Español."
      }
    });
    
    const text = response.text || "No se pudo generar respuesta.";
    // Extract grounding metadata if available
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // FIX: Explicitly cast the result to ensure TypeScript allows assignment to ChatMessage['sources']
    // This removes any ambiguity about 'null' values remaining in the array.
    const sources = groundingChunks
      .map((chunk: any) => chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null)
      .filter((item: any) => item !== null) as { uri: string; title: string }[];

    return { text, sources };
  } catch (error) {
    console.error("Error in chat:", error);
    throw error;
  }
};
