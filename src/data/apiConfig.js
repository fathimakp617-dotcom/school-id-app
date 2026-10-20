// Web deployment uses the same-origin API. Android release builds set the hosted HTTPS API origin.
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
