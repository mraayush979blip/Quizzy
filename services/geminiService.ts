import { GoogleGenAI, Type, Schema } from "@google/genai";
import { StudyGoal, Difficulty, FileData } from "../types";
import { PROMPT_TEMPLATES } from "../constants";

interface GenerateOptions {
  topic: string;
  goal: StudyGoal;
  difficulty?: Difficulty;
  questionCount?: number;
  file?: FileData | null;
}

export const generateStudyContent = async ({
  topic, 
  goal, 
  difficulty = Difficulty.MEDIUM, 
  questionCount = 5,
  file
}: GenerateOptions): Promise<string> => {
  
  // 1. Debugging & Validation
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey.length === 0 || apiKey.includes("undefined")) {
      console.error("API Key check failed. Value:", apiKey);
      throw new Error("API Key is missing. Please check your EdgeOne/Vercel Environment Variables (VITE_API_KEY).");
  }

  // 2. Initialize client lazily with the validated key
  const ai = new GoogleGenAI({ apiKey });

  try {
    let instruction = PROMPT_TEMPLATES[goal];
    
    // Customize instruction based on options
    if (goal === StudyGoal.QUIZ) {
        instruction = `Create ${questionCount} ${difficulty.toLowerCase()} level multiple-choice questions about this topic to test understanding.`;
    } else if (goal === StudyGoal.FLASHCARDS) {
        instruction = `Create ${questionCount} ${difficulty.toLowerCase()} level flashcards covering key concepts, definitions, and interesting facts about the topic.`;
    }

    const parts: any[] = [];
    
    // Add File if exists
    if (file) {
        parts.push({
            inlineData: {
                mimeType: file.mimeType,
                data: file.data
            }
        });
        instruction += " Use the provided document/image as the primary source material.";
    }

    // Structured Output Logic
    if (goal === StudyGoal.QUIZ || goal === StudyGoal.FLASHCARDS) {
        
        let responseSchema: Schema;

        if (goal === StudyGoal.QUIZ) {
             responseSchema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        question: { type: Type.STRING },
                        options: { 
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        correctAnswer: { type: Type.STRING, description: "Must be one of the strings from the options array" },
                        explanation: { type: Type.STRING, description: "A brief explanation of why the answer is correct" }
                    },
                    required: ["question", "options", "correctAnswer", "explanation"]
                }
            };
        } else {
            // Flashcards Schema
            responseSchema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        front: { type: Type.STRING, description: "The concept, question, or term on the front of the card" },
                        back: { type: Type.STRING, description: "The definition, answer, or explanation on the back" }
                    },
                    required: ["front", "back"]
                }
            };
        }

        // Add text prompt
        parts.push({
            text: `Generate content about: "${topic}". ${instruction}`
        });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        });
        
        const text = response.text;
        if (!text) throw new Error("No content generated from Gemini.");
        return text;

    } else {
        // Standard Text generation
        const finalPrompt = `
          You are an expert tutor designed to help students learn visually and conceptually.
          
          Task: ${instruction}
          Topic: ${topic}
          
          Formatting Guidelines for better understanding:
          1. **Typography**: Use clear headings (##, ###) to break down complex ideas.
          2. **Visuals**: You MUST include at least 1-2 relevant illustrative images. Use this markdown format exactly to generate images dynamically: 
             ![Alt Text for Image](https://image.pollinations.ai/prompt/DESCRIPTION_OF_IMAGE_URL_ENCODED?width=800&height=500&nologo=true)
             (Replace DESCRIPTION_OF_IMAGE_URL_ENCODED with a specific visual description of the concept, e.g., 'solar%20system%20planets%20orbiting', 'molecular%20structure%20of%20water', etc.)
          3. **Emphasis**: Use **bold** for key terms and *italics* for definitions.
          4. **Lists**: Use bullet points for readability.
          5. **Tone**: Engaging, clear, and educational.
        `;
        
        parts.push({ text: finalPrompt });
    
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts },
          config: {
            temperature: 0.7,
          }
        });
    
        const text = response.text;
        if (!text) {
          throw new Error("No content generated from the model.");
        }
    
        return text;
    }

  } catch (error: any) {
    console.error("Gemini API Error Full Details:", error);
    
    // Pass the actual error message to the UI
    const msg = error.message || error.toString();
    
    if (msg.includes("404") || msg.includes("not found")) {
        throw new Error("Model not found. Check if the API Key has access to 'gemini-2.5-flash'.");
    }
    
    throw new Error(msg);
  }
};