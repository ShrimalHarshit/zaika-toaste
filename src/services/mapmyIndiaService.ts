import { getMapMyIndiaToken } from "./mapmyindiaToken";

export interface MapmyIndiaSuggestion {
  eLoc: string;
  placeName: string;
  placeAddress: string;
}

export const getAddressSuggestions = async (q: string) => {
  const token = await getMapMyIndiaToken();
  if (!token) return [];

  const resp = await fetch(
    `https://atlas.mapmyindia.com/api/places/search/json?query=${encodeURIComponent(q)}&region=IND`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  const data = await resp.json();
  return data.suggestedLocations || [];
};

export const getPlaceDetails = async (eLoc: string) => {
  try {
    const token = await getMapMyIndiaToken();
    const resp = await fetch(`https://atlas.mapmyindia.com/api/places/detail/json?eLoc=${eLoc}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error("Failed to fetch place details");
    return await resp.json();
  } catch (err) {
    console.error("MapMyIndia Place Details Error:", err);
    return null;
  }
};
