import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateResponse } from '../ollama'

// Mock the global $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('ollama utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset env vars if needed
    process.env.OLLAMA_API_URL = 'http://localhost:11434'
    process.env.OLLAMA_MODEL = 'llama3'
  })

  describe('generateResponse', () => {
    it('should generate a response successfully', async () => {
      const mockResponse = { response: 'Hello, world!' }
      mockFetch.mockResolvedValue(mockResponse)

      const prompt = 'Hello'
      const response = await generateResponse(prompt)

      expect(response).toBe(mockResponse.response)
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', {
        method: 'POST',
        body: {
          model: 'llama3',
          prompt,
          stream: false
        }
      })
    })

    it('should use custom model and API URL', async () => {
      process.env.OLLAMA_API_URL = 'http://custom-ollama:1234'
      process.env.OLLAMA_MODEL = 'custom-model'
      
      const mockResponse = { response: 'Custom response' }
      mockFetch.mockResolvedValue(mockResponse)

      const prompt = 'Test'
      const response = await generateResponse(prompt, 'custom-model')

      expect(response).toBe(mockResponse.response)
      expect(mockFetch).toHaveBeenCalledWith('http://custom-ollama:1234/api/generate', expect.objectContaining({
        body: expect.objectContaining({
          model: 'custom-model'
        })
      }))
    })

    it('should throw an error if Ollama communication fails', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'))

      await expect(generateResponse('Hello')).rejects.toThrow('Failed to generate response from Ollama')
      expect(mockFetch).toHaveBeenCalled()
    })
  })
})
