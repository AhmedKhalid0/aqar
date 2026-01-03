/**
 * API Communication Module
 * Handles all API calls to the backend
 */

/**
 * Fetch data from API endpoint
 * @param {string} endpoint - API endpoint path
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} - API response data
 */
Site.fetchAPI = async function (endpoint, options = {}) {
    try {
        const response = await fetch(`${Config.API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};
