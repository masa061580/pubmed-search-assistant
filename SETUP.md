# PubMed Search Assistant - Setup Guide

This guide will help you set up and run the PubMed Search Assistant on your local machine or server.

## Prerequisites

Before you begin, make sure you have the following:

- Node.js (v14 or higher)
- npm (Node Package Manager)
- An OpenAI API key
- Optional: NCBI API key for higher rate limits

## Installation

1. Clone this repository:
```bash
git clone https://github.com/masa061580/pubmed-search-assistant.git
cd pubmed-search-assistant
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Edit the `.env` file and add your API keys:
```
OPENAI_API_KEY=your_openai_api_key_here
NCBI_API_KEY=your_ncbi_api_key_here
PORT=3000
```

## Running the Application

Start the server:
```bash
npm start
```

For development with auto-restart on file changes:
```bash
npm run dev
```

The server will run on port 3000 by default (or the port specified in your `.env` file).

## API Usage

The application exposes a single endpoint for chat interactions:

### POST /chat

Send a message to the PubMed Search Assistant.

**Request Body:**
```json
{
  "message": "Find papers about diabetes treatment with metformin",
  "conversationId": "unique-conversation-id"
}
```

**Response:**
```json
{
  "message": "I found 563 papers on diabetes treatment with metformin. Here are 5 representative papers: [papers details...]",
  "conversationId": "unique-conversation-id"
}
```

The `conversationId` is used to maintain conversation history. Use the same ID for follow-up messages in the same conversation.

## Testing the Application

You can test the API using curl:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Find papers about diabetes treatment", "conversationId": "test-1"}'
```

Or using a tool like Postman to send POST requests to the `/chat` endpoint.

## OpenAI Model Selection

The application is configured to use `gpt-4-0125-preview` by default. You can change this in the `app.js` file to use a different model if needed.

## PubMed API Rate Limits

Be aware of NCBI E-utilities API rate limits:
- Without an API key: 3 requests per second
- With an API key: 10 requests per second

The application includes a delay between requests to respect these limits.

## Customization

You can modify the system prompt in `app.js` to change how the assistant behaves or add specific instructions for handling medical literature searches.

## Troubleshooting

If you encounter issues:

1. Check your API keys in the `.env` file
2. Ensure you're respecting PubMed's rate limits
3. Check the server logs for error messages
4. Verify your OpenAI account has sufficient credits

## Additional Resources

- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [NCBI E-utilities Documentation](https://www.ncbi.nlm.nih.gov/books/NBK25501/)
- [PubMed API User Guide](https://www.ncbi.nlm.nih.gov/home/develop/api/)
