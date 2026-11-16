// Calibration of the EXISTING map.svg (viewBox 0 0 1000 481) to WGS84 lat/lon.
// The SVG is a linear lat/lon projection fitted to Mongolia's published extent
// (41°35'N–52°09'N, 87°44'E–119°56'E). Accuracy is approximate (province scale):
// 18 of 22 aimag centres fall inside the correct SVG polygon; the other 4 are small
// provinces overlapped by neighbours in the simplified SVG.
export const GEO_BOUNDS = { latMin: 41.5833, latMax: 52.15, lonMin: 87.7333, lonMax: 119.9333 };
export const SVG_BOUNDS = { xMin: 45.5, xMax: 954.5, yMin: 21.9, yMax: 459.6 };

export function isValidMongoliaCoord(lat, lon) {
  return (
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= GEO_BOUNDS.latMin && lat <= GEO_BOUNDS.latMax &&
    lon >= GEO_BOUNDS.lonMin && lon <= GEO_BOUNDS.lonMax
  );
}

export function geoToSvg(lat, lon) {
  const { latMin, latMax, lonMin, lonMax } = GEO_BOUNDS;
  const { xMin, xMax, yMin, yMax } = SVG_BOUNDS;
  return {
    x: xMin + ((lon - lonMin) / (lonMax - lonMin)) * (xMax - xMin),
    y: yMin + ((latMax - lat) / (latMax - latMin)) * (yMax - yMin),
  };
}
