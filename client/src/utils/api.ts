export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  try {
    // Don't manually set Content-Type for FormData
    const hasFormData = options.body instanceof FormData;

    const response = await fetch(endpoint, {
      ...options,
      headers: {
        ...(hasFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    });

    // Get the response text first
    const responseText = await response.text();

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