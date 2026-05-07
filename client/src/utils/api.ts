export async function apiRequest<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  try {
    const hasFormData = options.body instanceof FormData;

    const response = await fetch(endpoint, {
      ...options,
      credentials: 'include',
      headers: {
        ...(hasFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      body: hasFormData
        ? options.body
        : (typeof options.body === 'object' && !hasFormData)
          ? JSON.stringify(options.body)
          : options.body,
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}. Server message: ${
            errorData.message || JSON.stringify(errorData)
          }`
        );
      } catch {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}. Response: ${responseText}`
        );
      }
    }

    if (!responseText) return {} as T;

    return JSON.parse(responseText) as T;
  } catch (error) {
    throw error;
  }
}