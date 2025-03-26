export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  try {
    // Check if we're sending FormData
    const hasFormData = options.body instanceof FormData;
    
    // Log detailed request information for debugging
    console.log(`API Request to: ${endpoint}`);
    console.log(`Method: ${options.method || 'GET'}`);
    console.log(`Is FormData: ${hasFormData}`);
    
    if (hasFormData) {
      console.log("FormData payload detected (contents not enumerated for compatibility)");
    }

    const response = await fetch(endpoint, {
      ...options,
      // Always include credentials for cross-domain cookie sessions
      credentials: 'include',
      headers: {
        // Don't set Content-Type for FormData, browser will set it with boundary
        ...(hasFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      // Important: Don't transform the body for FormData
      // For JSON, we need to stringify
      body: hasFormData 
        ? options.body 
        : (typeof options.body === 'object' && !hasFormData) 
          ? JSON.stringify(options.body) 
          : options.body,
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    // Get the response text first
    const responseText = await response.text();
    console.log(`Response text: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);

    if (!response.ok) {
      // Try to parse as JSON for error details
      let errorData;
      try {
        errorData = JSON.parse(responseText);
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}. Server message: ${
            errorData.message || JSON.stringify(errorData)
          }`
        );
      } catch (parseError) {
        // If can't parse, use the raw text
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}. Response: ${responseText}`
        );
      }
    }

    // If response is empty, return empty object
    if (!responseText) return {};

    // Parse successful response as JSON
    return JSON.parse(responseText);
  } catch (error) {
    console.error("API Request Error:", error);
    throw error;
  }
}