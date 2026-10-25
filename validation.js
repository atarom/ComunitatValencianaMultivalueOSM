export const validate = (tags = {}, mode = "name") => {
  const base = tags[mode === "official" ? "official_name" : "name"] || "";
  const ca = (tags["name:ca"] || "").trim();
  const es = (tags["name:es"] || "").trim();
  const parts = base.split(/[\/;]/).map((part) => part.trim()).filter(Boolean);
  const separators = [];
  for (let i = 0; i < base.length; i++) {
    const char = base[i];
    if (char !== "/" && char !== ";") continue;
    const valid = char === ";"
      ? i > 0 && i < base.length - 1 && !/\s/.test(base[i - 1]) && !/\s/.test(base[i + 1])
      : i > 0 && i < base.length - 1 && base[i - 1] === " " && base[i + 1] === " " && base[i - 2] !== " " && base[i + 2] !== " ";
    separators.push({ index: i, char, valid });
  }
  const separatorCount = separators.length;
  const badSep = separators.some((separator) => !separator.valid);
  const missingTags = !tags["name:ca"] || !tags["name:es"];
  const missing = !ca || !es;
  const duplicateParts = parts.length > 1 && parts.every((part) => part === parts[0]);
  const duplicate = !!(base && !badSep && separatorCount <= 1 && ca && es && duplicateParts);
  const includes = !!(base && ca && es && parts.includes(ca) && parts.includes(es));
  const first = parts[0];
  const name = (tags.name || "").trim();
  const officialNameOk = mode !== "official" || !!(parts.length && name && ((first === ca && name === ca) || (first === es && name === es)));
  let key;
  if (!base) key = "cP";
  else if (separatorCount > 1) key = "cM";
  else if (badSep) key = "cO";
  else if (missingTags) key = "cB";
  else if (duplicateParts) key = "cD";
  else if (!parts.includes(ca) || !parts.includes(es) || (first !== ca && first !== es) || !officialNameOk) key = "cP";
  else key = first === ca ? "cY" : "cR";
  const listError = !missingTags && (!base || separatorCount > 1 || badSep || duplicateParts || !parts.includes(ca) || !parts.includes(es) || !officialNameOk);
  return { base, ca, es, parts, separators, separatorCount, badSep, missingTags, missing, duplicate, includes, officialNameOk, key, listError };
};
