export async function generateResponse(prompt: string, model: string = process.env.OLLAMA_MODEL || 'llama3'): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
  
  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
    const result = await response.json() as { response: string };
    return result.response;
  } catch (error) {
    console.error('Error communicating with Ollama:', error);
    throw new Error('Failed to generate response from Ollama');
  }
}
