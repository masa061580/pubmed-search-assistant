/**
 * PubMed Search API - Implementation for OpenAI function calling
 * This file contains functions to search PubMed using the E-utilities API
 */

const axios = require('axios');
const xml2js = require('xml2js');

// NCBI API settings
const NCBI_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
const PUBMED_WEB_URL = 'https://pubmed.ncbi.nlm.nih.gov/';

// Add your API key if you have one
const API_KEY = process.env.NCBI_API_KEY || '';
const DEFAULT_DELAY = 300; // ms delay between requests (recommended by NCBI)

/**
 * Convert user query to MeSH terms
 * @param {string} query - User's query
 * @returns {Promise<string>} - MeSH terms
 */
async function convertToMeshTerms(query) {
  try {
    // Ideally, you would use NCBI's API to properly convert to MeSH terms
    // For simplicity, this is a basic conversion
    
    // Clean up query
    const sanitizedQuery = query.replace(/[^\w\s]/gi, '');
    const terms = sanitizedQuery.split(/\s+/).filter(term => term.length > 2);
    
    // Create a basic MeSH term string
    const meshTerms = terms.join('+AND+');
    
    return meshTerms;
  } catch (error) {
    console.error('Error converting to MeSH terms:', error);
    throw new Error('Failed to convert query to MeSH terms');
  }
}

/**
 * Search PubMed using the E-utilities API
 * @param {string} meshTerms - MeSH terms for search
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Object>} - Search results
 */
async function searchPubMed(meshTerms, maxResults = 5) {
  try {
    // Step 1: Use esearch to get IDs
    const searchUrl = `${NCBI_BASE_URL}esearch.fcgi?db=pubmed&term=${meshTerms}&retmax=100&retmode=json&sort=relevance${API_KEY ? '&api_key=' + API_KEY : ''}`;
    const searchResponse = await axios.get(searchUrl);
    const idList = searchResponse.data.esearchresult.idlist;
    const totalResults = parseInt(searchResponse.data.esearchresult.count);
    
    // If no results, return early
    if (totalResults === 0) {
      return {
        meshTerms,
        searchUrl: `${PUBMED_WEB_URL}?term=${meshTerms}`,
        totalResults: 0,
        papers: []
      };
    }
    
    // Limit to maxResults
    const limitedIds = idList.slice(0, maxResults);
    
    // Delay to respect NCBI rate limits
    await new Promise(resolve => setTimeout(resolve, DEFAULT_DELAY));
    
    // Step 2: Use esummary to get paper details
    const summaryUrl = `${NCBI_BASE_URL}esummary.fcgi?db=pubmed&id=${limitedIds.join(',')}&retmode=json${API_KEY ? '&api_key=' + API_KEY : ''}`;
    const summaryResponse = await axios.get(summaryUrl);
    const results = summaryResponse.data.result;
    
    // Process paper data
    const papers = limitedIds.map(id => {
      const paper = results[id];
      return {
        title: paper.title,
        authors: paper.authors.map(author => author.name).join(', '),
        journal: paper.fulljournalname,
        publicationDate: paper.pubdate,
        doi: paper.elocationid || '',
        pmid: id,
        abstract: '', // Abstract requires a separate efetch request
        url: `${PUBMED_WEB_URL}${id}/`
      };
    });
    
    // Step 3: Get abstracts (this could be optimized to fetch in batches)
    for (let i = 0; i < papers.length; i++) {
      // Delay to respect NCBI rate limits
      await new Promise(resolve => setTimeout(resolve, DEFAULT_DELAY));
      
      try {
        const abstractUrl = `${NCBI_BASE_URL}efetch.fcgi?db=pubmed&id=${papers[i].pmid}&retmode=xml${API_KEY ? '&api_key=' + API_KEY : ''}`;
        const abstractResponse = await axios.get(abstractUrl);
        
        // Parse XML to extract abstract
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(abstractResponse.data);
        
        const articleData = result.PubmedArticleSet.PubmedArticle.MedlineCitation.Article;
        if (articleData.Abstract && articleData.Abstract.AbstractText) {
          // Handle different abstract formats
          if (Array.isArray(articleData.Abstract.AbstractText)) {
            papers[i].abstract = articleData.Abstract.AbstractText.map(section => {
              if (typeof section === 'object') {
                return `${section.$.Label}: ${section._}`;
              }
              return section;
            }).join('\n');
          } else if (typeof articleData.Abstract.AbstractText === 'object') {
            papers[i].abstract = `${articleData.Abstract.AbstractText.$.Label}: ${articleData.Abstract.AbstractText._}`;
          } else {
            papers[i].abstract = articleData.Abstract.AbstractText;
          }
        } else {
          papers[i].abstract = 'Abstract not available';
        }
      } catch (error) {
        console.error(`Error fetching abstract for paper ${papers[i].pmid}:`, error);
        papers[i].abstract = 'Error retrieving abstract';
      }
    }
    
    return {
      meshTerms,
      searchUrl: `${PUBMED_WEB_URL}?term=${meshTerms}`,
      totalResults,
      papers
    };
  } catch (error) {
    console.error('Error searching PubMed:', error);
    throw new Error('Failed to search PubMed');
  }
}

/**
 * Refine MeSH terms based on user feedback
 * @param {string} originalQuery - Original search query
 * @param {string} previousMeshTerms - Previous MeSH terms used for search
 * @param {string} refinementType - Type of refinement: 'increase', 'decrease', or 'keep'
 * @param {string} additionalCriteria - Additional criteria to refine the search
 * @returns {Promise<string>} - Refined MeSH terms
 */
async function refineMeshTerms(originalQuery, previousMeshTerms, refinementType, additionalCriteria) {
  // Handle based on refinement type
  switch (refinementType) {
    case 'increase':
      // Make search broader by removing some terms
      const terms = previousMeshTerms.split('+AND+');
      if (terms.length > 1) {
        // Remove the most specific (usually last) term to broaden
        return terms.slice(0, -1).join('+AND+');
      } else {
        // If only one term, try to use a broader approach
        return terms[0] + '+OR+review[pt]';
      }
    
    case 'decrease':
      // Make search more specific by adding terms
      if (additionalCriteria && additionalCriteria.trim()) {
        const additionalMesh = await convertToMeshTerms(additionalCriteria);
        return previousMeshTerms + '+AND+' + additionalMesh;
      } else {
        // Without specific criteria, add publication date restriction
        return previousMeshTerms + '+AND+("last+5+years"[PDat])';
      }
    
    case 'keep':
    default:
      // Keep the same MeSH terms
      return previousMeshTerms;
  }
}

/**
 * Main function to search PubMed based on user query
 * @param {Object} params - Parameters for search
 * @param {string} params.query - User's query
 * @param {number} params.maxResults - Maximum number of results to return
 * @returns {Promise<Object>} - Search results
 */
async function searchPubMedWithQuery(params) {
  const { query, maxResults = 5 } = params;
  
  try {
    // Convert query to MeSH terms
    const meshTerms = await convertToMeshTerms(query);
    
    // Perform search
    const results = await searchPubMed(meshTerms, maxResults);
    
    return results;
  } catch (error) {
    console.error('Error in searchPubMedWithQuery:', error);
    throw error;
  }
}

/**
 * Main function to refine PubMed search
 * @param {Object} params - Parameters for refinement
 * @param {string} params.originalQuery - Original search query
 * @param {string} params.previousMeshTerms - Previous MeSH terms used for search
 * @param {string} params.refinementType - Type of refinement: 'increase', 'decrease', or 'keep'
 * @param {string} params.additionalCriteria - Additional criteria to refine the search
 * @param {number} params.maxResults - Maximum number of results to return
 * @returns {Promise<Object>} - Refined search results
 */
async function refinePubMedSearch(params) {
  const { 
    originalQuery, 
    previousMeshTerms, 
    refinementType, 
    additionalCriteria,
    maxResults = 5
  } = params;
  
  try {
    // Refine MeSH terms
    const meshTerms = await refineMeshTerms(
      originalQuery, 
      previousMeshTerms, 
      refinementType, 
      additionalCriteria
    );
    
    // Perform search with refined terms
    const results = await searchPubMed(meshTerms, maxResults);
    
    return results;
  } catch (error) {
    console.error('Error in refinePubMedSearch:', error);
    throw error;
  }
}

module.exports = {
  searchPubMedWithQuery,
  refinePubMedSearch
};
