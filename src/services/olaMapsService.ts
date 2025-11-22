/**
 * Ola Maps Geocoding & Places Service
 * Uses Ola Maps API for address search, autocomplete, and reverse geocoding
 * API Key: GWtbYbRMCeFmUvsV4yQoc6QSYIHPrqxL9LaoPB9t
 * Server: https://api.olamaps.io
 */

const OLA_MAPS_API_KEY = "GWtbYbRMCeFmUvsV4yQoc6QSYIHPrqxL9LaoPB9t";
const OLA_MAPS_SERVER = "https://api.olamaps.io";

export interface OlaMapsPlace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  formatted_address?: string;
}

export interface OlaMapsPlaceDetails {
  result: {
    name: string;
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    address_components?: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
  };
  status: string;
}

/**
 * Search for addresses using Ola Maps Places Autocomplete API
 * @param query Search query (e.g., "pizza near Delhi", "restaurant")
 * @returns Array of place suggestions with coordinates
 */
export const getAddressSuggestions = async (
  query: string
): Promise<OlaMapsPlace[]> => {
  if (!query || query.length < 3) return [];

  try {
    const params = new URLSearchParams({
      input: query,
      api_key: OLA_MAPS_API_KEY,
    });

    const response = await fetch(
      `${OLA_MAPS_SERVER}/places/v1/autocomplete?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error("Ola Maps autocomplete error:", response.status, response.statusText);
      return [];
    }

    const data = await response.json();

    // Map Ola Maps autocomplete response to our interface
    if (data.predictions && Array.isArray(data.predictions)) {
      return data.predictions.map((prediction: any, idx: number) => ({
        id: prediction.place_id || `ola-${idx}`,
        name: prediction.main_text || prediction.description || "",
        address: prediction.secondary_text || prediction.description || "",
        formatted_address: prediction.description,
        latitude: prediction.geometry?.location?.lat || 20.5937,
        longitude: prediction.geometry?.location?.lng || 78.9629,
      }));
    }

    console.warn("No predictions in Ola Maps response:", data);
    return [];
  } catch (error) {
    console.error("Address search error:", error);
    return [];
  }
};

/**
 * Get detailed address information using Ola Maps Reverse Geocode API
 * @param lat Latitude coordinate
 * @param lng Longitude coordinate
 * @returns Detailed address information including address components
 */
export const getPlaceDetails = async (
  lat: number,
  lng: number
): Promise<OlaMapsPlaceDetails | null> => {
  try {
    const params = new URLSearchParams({
      latlng: `${lat},${lng}`,
      api_key: OLA_MAPS_API_KEY,
    });

    const response = await fetch(
      `${OLA_MAPS_SERVER}/places/v1/reverse-geocode?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error("Ola Maps reverse geocode error:", response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    // Map Ola Maps reverse geocode response to our interface
    if (data.results && data.results.length > 0) {
      const primaryResult = data.results[0];

      return {
        result: {
          name: primaryResult.name || primaryResult.formatted_address?.split(",")[0] || "Location",
          formatted_address: primaryResult.formatted_address || `${lat}, ${lng}`,
          geometry: {
            location: {
              lat: lat,
              lng: lng,
            },
          },
          address_components: primaryResult.address_components || [],
        },
        status: "OK",
      };
    }

    // Fallback if no results
    console.warn("No reverse geocode results for coordinates:", lat, lng);
    return {
      result: {
        name: "Location",
        formatted_address: `${lat}, ${lng}`,
        geometry: {
          location: { lat, lng },
        },
        address_components: [],
      },
      status: "OK",
    };
  } catch (error) {
    console.error("Place details error:", error);
    return null;
  }
};

/**
 * Extract structured address from Ola Maps address components
 */
export const extractAddressComponents = (
  components: OlaMapsPlaceDetails["result"]["address_components"] | undefined
) => {
  const address = {
    street: "",
    city: "",
    state: "",
    pinCode: "",
  };

  if (!components || !Array.isArray(components)) return address;

  components.forEach((component) => {
    const types = component.types || [];
    const longName = component.long_name || "";

    if (types.includes("route") || types.includes("premise")) {
      address.street = longName;
    } else if (
      types.includes("locality") ||
      types.includes("administrative_area_level_3")
    ) {
      address.city = longName;
    } else if (types.includes("administrative_area_level_1")) {
      address.state = longName;
    } else if (types.includes("postal_code")) {
      address.pinCode = longName;
    }
  });

  return address;
};
