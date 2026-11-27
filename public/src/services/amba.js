const config = window.AMBA_GM_CONFIG || {};
export const apiBaseUrl = String(config.apiBaseUrl || "/api/v1").replace(/\/$/, "");
export const appUrl = String(config.appUrl || apiBaseUrl.replace(/\/api\/v1$/, "")).replace(/\/$/, "");
function errorMessage(status) {
  if (status === 401) return "AMBA sign-in is required. Sign in to AMBA, then return here and connect again.";
  if (status === 403) return "AMBA denied access to this module list.";
  return `AMBA returned an error (${status}). Check the connection settings and try again.`;
}

export async function apiGet(path) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw Object.assign(new Error(errorMessage(response.status)), { status: response.status });
  return response.json();
}
