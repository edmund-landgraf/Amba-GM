export function campaignPersistenceMode(backend, hasRepository) {
  if (backend === "postgres") return "postgres";
  if (hasRepository) return "sqlite";
  return "none";
}
