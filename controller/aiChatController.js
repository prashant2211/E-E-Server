const fetch = global.fetch || require('node-fetch')
const { logger } = require('../utils/logger')
const { successResponse, errorResponse } = require('../utils/response')

// Support multiple env var names, since key may be stored as OPENAI_KEY in .env
const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || process.env.OPENAI_SECRET_KEY || process.env.OPENAI_KEY
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

// Simple AI chat proxy to OpenAI Chat Completions API
const sendMessage = async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return errorResponse(res, 'OpenAI API key is not configured on server', 500)
    }

    const { conversationId, messages } = req.body || {}

    if (!Array.isArray(messages) || messages.length === 0) {
      return errorResponse(res, 'messages array is required', 400)
    }

    // Basic safety: truncate conversation to last 20 messages
    const truncatedMessages = messages.slice(-20)

    const body = {
      model: 'gpt-4.1-mini',
      messages: truncatedMessages,
      temperature: 0.7,
      max_tokens: 800,
    }

    logger.info('AI chat request received', {
      conversationId: conversationId || 'new',
      messageCount: truncatedMessages.length,
    })

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('OpenAI API error', {
        status: response.status,
        body: errorText,
      })
      return errorResponse(
        res,
        `Failed to get response from AI: ${response.status} ${response.statusText}`,
        500
      )
    }

    const data = await response.json()
    const choice = data.choices && data.choices[0]
    const aiMessage = choice?.message

    if (!aiMessage) {
      return errorResponse(res, 'AI returned empty response', 500)
    }

    const finalConversationId = conversationId || `conv_${Date.now()}`

    return successResponse(
      res,
      {
        conversationId: finalConversationId,
        message: aiMessage,
        usage: data.usage || null,
      },
      'AI response generated successfully'
    )
  } catch (error) {
    logger.error('Error in AI chat controller', {
      message: error.message,
      stack: error.stack,
    })
    return errorResponse(res, 'Internal server error while calling AI', 500)
  }
}

module.exports = {
  sendMessage,
}


