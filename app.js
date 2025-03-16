/**
 * PubMed Search Assistant - OpenAI Function Calling Integration
 * This file demonstrates how to use the PubMed Search API with OpenAI's function calling
 */

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const pubmedApi = require('./pubmed-api');

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Define OpenAI functions
const openAiFunctions = [
  {
    name: 'searchPubMedWithQuery',
    description: 'Searches PubMed using MeSH terms based on user query and returns relevant papers.',
    parameters: {
      type: 'object',
      required: ['query'],
      properties: {
        query: {
          type: 'string',
          description: 'User\'s research topic or keywords.'
        },
        maxResults: {
          type: 'integer',
          description: 'Maximum number of results to return (default: 5).'
        }
      }
    }
  },
  {
    name: 'refinePubMedSearch',
    description: 'Refines PubMed search by modifying MeSH terms to increase or decrease result count.',
    parameters: {
      type: 'object',
      required: ['originalQuery', 'previousMeshTerms', 'refinementType'],
      properties: {
        originalQuery: {
          type: 'string',
          description: 'Original search query.'
        },
        previousMeshTerms: {
          type: 'string',
          description: 'Previous MeSH terms used for search.'
        },
        refinementType: {
          type: 'string',
          description: 'Type of refinement: "increase", "decrease", or "keep".',
          enum: ['increase', 'decrease', 'keep']
        },
        additionalCriteria: {
          type: 'string',
          description: 'Additional criteria to refine the search.'
        },
        maxResults: {
          type: 'integer',
          description: 'Maximum number of results to return (default: 5).'
        }
      }
    }
  }
];

// Map of function names to implementation functions
const functionMap = {
  searchPubMedWithQuery: pubmedApi.searchPubMedWithQuery,
  refinePubMedSearch: pubmedApi.refinePubMedSearch
};

// Store conversation history
const conversations = {};

// Endpoint for chat
app.post('/chat', async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Initialize or retrieve conversation history
    if (!conversations[conversationId]) {
      conversations[conversationId] = [];
    }
    
    const conversationHistory = conversations[conversationId];
    
    // Add user message to history
    conversationHistory.push({
      role: 'user',
      content: message
    });
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4-0125-preview', // Update with your preferred model
      messages: [
        {
          role: 'system',
          content: `You are a helpful PubMed search assistant that helps users find medical literature. 
          Follow this workflow:
          1. When the user asks to search for medical literature, use the searchPubMedWithQuery function.
          2. After showing search results, ask if they want to refine the search to get more results, fewer results, or keep the current results.
          3. Based on their response, use the refinePubMedSearch function with the appropriate refinementType.
          4. Continue this process until the user is satisfied with the results.
          
          When presenting search results:
          - Show the total number of papers found
          - List the representative papers with title, authors, journal, and publication date
          - Include a brief description of each paper based on its abstract
          - Format the results in a readable way with numbering
          
          Be conversational, helpful, and knowledgeable about medical research.`
        },
        ...conversationHistory
      ],
      functions: openAiFunctions,
      function_call: 'auto'
    });
    
    const responseMessage = response.choices[0].message;
    
    // Check if function call is needed
    if (responseMessage.function_call) {
      const functionName = responseMessage.function_call.name;
      const functionArgs = JSON.parse(responseMessage.function_call.arguments);
      
      // Call the appropriate function
      if (functionMap[functionName]) {
        const functionResult = await functionMap[functionName](functionArgs);
        
        // Add assistant's message (with function call) to history
        conversationHistory.push(responseMessage);
        
        // Add function result to history
        conversationHistory.push({
          role: 'function',
          name: functionName,
          content: JSON.stringify(functionResult)
        });
        
        // Get a new response from OpenAI with the function result
        const secondResponse = await openai.chat.completions.create({
          model: 'gpt-4-0125-preview', // Update with your preferred model
          messages: conversationHistory
        });
        
        const secondResponseMessage = secondResponse.choices[0].message;
        
        // Add assistant's second message to history
        conversationHistory.push(secondResponseMessage);
        
        // Return the final response
        return res.json({
          message: secondResponseMessage.content,
          conversationId
        });
      } else {
        return res.status(500).json({ error: `Function ${functionName} not implemented` });
      }
    } else {
      // No function call needed, just return the response
      conversationHistory.push(responseMessage);
      
      return res.json({
        message: responseMessage.content,
        conversationId
      });
    }
  } catch (error) {
    console.error('Error processing chat request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
