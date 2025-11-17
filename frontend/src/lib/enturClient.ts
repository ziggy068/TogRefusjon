/**
 * Entur GraphQL API Client
 *
 * Provides a generic query interface for Entur Journey Planner v3 API.
 * https://developer.entur.org/pages-intro-introduction
 */

const ENTUR_GRAPHQL_URL = 'https://api.entur.io/journey-planner/v3/graphql';

/**
 * Execute a GraphQL query against Entur Journey Planner API
 *
 * @param query - GraphQL query string
 * @param variables - Optional variables for the query
 * @returns Parsed response data
 * @throws Error if HTTP fails or GraphQL returns errors
 */
export async function enturQuery<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const clientName =
    process.env.NEXT_PUBLIC_ENTUR_CLIENT_NAME || 'togrefusjon-dev-unknown';

  try {
    const response = await fetch(ENTUR_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ET-Client-Name': clientName,
      },
      body: JSON.stringify({
        query,
        variables: variables || {},
      }),
      cache: 'no-store', // Always fetch fresh data for real-time accuracy
    });

    if (!response.ok) {
      throw new Error(
        `Entur API HTTP error: ${response.status} ${response.statusText}`
      );
    }

    const json = await response.json();

    // Check for GraphQL errors
    if (json.errors && json.errors.length > 0) {
      const firstError = json.errors[0];
      throw new Error(
        `Entur GraphQL error: ${firstError.message || JSON.stringify(firstError)}`
      );
    }

    return json.data as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error; // Re-throw with original message
    }
    throw new Error(`Entur API call failed: ${String(error)}`);
  }
}
