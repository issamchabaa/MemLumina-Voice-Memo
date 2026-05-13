const { GoogleGenAI } = require('@google/genai');

async function test() {
  const ai = new GoogleGenAI({ project: 'sheep-db1', location: 'us-central1', vertexai: true });
  try {
    const aiResponse = await ai.models.generateContent({
      model: 'gemini-1.5-flash-002',
      contents: [{ text: "Hello" }]
    });
    console.log("Success:", aiResponse.text);
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
