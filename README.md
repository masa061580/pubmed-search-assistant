# PubMed Search Assistant

This repository contains an OpenAI schema for creating a PubMed search assistant that helps users find relevant medical literature through an interactive search process.

## Workflow

The PubMed Search Assistant follows this workflow:

1. The user inputs their search query related to medical literature.
2. The system converts the user's query into appropriate MeSH Terms and performs a search on PubMed using the URL: `https://pubmed.ncbi.nlm.nih.gov/?term={Mesh Term}`.
3. The system presents the search results, including the total number of papers found and details of 5 representative papers (title, journal, authors, abstract).
4. The system asks the user if they want to refine the search to get more results, fewer results, or keep the current results.
5. Based on the user's response, the system returns to step 2 and modifies the MeSH Terms accordingly.
6. The process continues until the user is satisfied with the search results.

## Implementation

The OpenAI schema (`pubmed_schema.json`) defines two main functions:

1. `searchPubMed`: Performs the initial search based on the user's query
2. `refinePubMedSearch`: Refines the search based on user feedback

### OpenAI Function Implementation

To use this with OpenAI's function calling, you would set up your functions like this:

```javascript
const functions = [
  {
    name: "searchPubMed",
    description: "Searches PubMed using MeSH terms based on user query and returns relevant papers.",
    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "User's research topic or keywords."
        },
        maxResults: {
          type: "integer",
          description: "Maximum number of results to return (default: 5)."
        }
      }
    }
  },
  {
    name: "refinePubMedSearch",
    description: "Refines PubMed search by modifying MeSH terms to increase or decrease result count.",
    parameters: {
      type: "object",
      required: ["originalQuery", "previousMeshTerms", "refinementType"],
      properties: {
        originalQuery: {
          type: "string",
          description: "Original search query."
        },
        previousMeshTerms: {
          type: "string",
          description: "Previous MeSH terms used for search."
        },
        refinementType: {
          type: "string",
          description: "Type of refinement: 'increase', 'decrease', or 'keep'.",
          enum: ["increase", "decrease", "keep"]
        },
        additionalCriteria: {
          type: "string",
          description: "Additional criteria to refine the search."
        },
        maxResults: {
          type: "integer",
          description: "Maximum number of results to return (default: 5)."
        }
      }
    }
  }
];
```

## Example Conversation Flow

Here's an example of how a conversation might flow:

**User**: I want to find papers about diabetes treatment with metformin.

**Assistant**: I'll search PubMed for papers about diabetes treatment with metformin.

[Assistant calls `searchPubMed("diabetes treatment metformin")`]

**Assistant**: I found 563 papers on diabetes treatment with metformin. Here are 5 representative papers:

1. "Metformin as first-line therapy in type 2 diabetes management" by Smith et al. in Journal of Diabetes Research
2. [4 more papers with details...]

Would you like to refine the search to get more results, fewer results, or are you satisfied with these results?

**User**: I'd like fewer results. Can we focus on recent clinical trials?

**Assistant**: I'll refine the search to focus on recent clinical trials.

[Assistant calls `refinePubMedSearch("diabetes treatment metformin", "diabetes+AND+treatment+AND+metformin", "decrease", "clinical trials recent")`]

**Assistant**: I've refined the search and found 87 papers on recent clinical trials of metformin for diabetes treatment. Here are 5 representative papers:

1. [Papers with details...]

Would you like to further refine your search, or are these results satisfactory?

**User**: These results look good. Thank you!

**Assistant**: You're welcome! I'm glad the search results are helpful. Let me know if you need any further assistance with your research.

## Implementation Notes

To fully implement this system, you would need to:

1. Develop a backend service that can convert user queries to MeSH terms
2. Use PubMed's E-utilities API to perform the actual searches
3. Parse the search results and extract relevant information
4. Implement the refinement logic to modify MeSH terms based on user feedback
5. Integrate the system with OpenAI's API for natural language interaction

### PubMed E-utilities API

PubMed provides the E-utilities API for programmatic access to their database. Key endpoints include:

- `esearch.fcgi`: Searches for terms and returns PMIDs
- `esummary.fcgi`: Retrieves document summaries for specified PMIDs
- `efetch.fcgi`: Retrieves full records in various formats

For more information, see the [E-utilities Documentation](https://www.ncbi.nlm.nih.gov/books/NBK25501/).

## Security and Rate Limiting

When implementing this system, be sure to:

- Follow NCBI's usage guidelines and policies
- Respect rate limits for the E-utilities API
- Include your API key in requests if you have one
- Implement proper error handling and retries

## License

This project is provided as an example implementation. Use it in accordance with PubMed's terms of service and API usage policies.
