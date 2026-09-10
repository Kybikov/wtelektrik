export function splitLocations(locations: string[]) {
  return [
    ...new Set(
      locations.flatMap((value) =>
        value
          .split(" · ")
          .map((part) => part.trim())
          .filter(Boolean),
      ),
    ),
  ];
}
export function citySuggestions(locations: string[], query: string, limit = 6) {
  const postal = /^\d/.test(query.trim());
  const values = [
    ...new Set(
      splitLocations(locations).map((value) =>
        postal ? value : value.replace(/^\d{4,5}\s+/, ""),
      ),
    ),
  ];
  const normalize = (value: string) =>
    value
      .toLocaleLowerCase("de")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  const needle = normalize(query.trim());
  const popular = [
    "Berlin",
    "Hamburg",
    "München",
    "Köln",
    "Frankfurt am Main",
    "Stuttgart",
  ];
  return values
    .filter((value) => !needle || normalize(value).includes(needle))
    .sort((a, b) => {
      {
        const ai = popular.indexOf(a),
          bi = popular.indexOf(b);
        if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      }
      const ap = normalize(a).startsWith(needle),
        bp = normalize(b).startsWith(needle);
      return Number(bp) - Number(ap) || a.localeCompare(b, "de");
    })
    .slice(0, limit);
}
