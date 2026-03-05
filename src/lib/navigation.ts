/**
 * Helper to build navigation URLs for Google Maps and Waze
 */

export function buildGoogleMapsUrl(lat: number, lon: number): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
}

export function buildWazeUrl(lat: number, lon: number): string {
    return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
}

export type NavApp = 'maps' | 'waze';

export const NAV_PREF_KEY = 'gasoia:navigationApp';

export function getNavPreference(): NavApp | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(NAV_PREF_KEY) as NavApp | null;
}

export function setNavPreference(app: NavApp): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(NAV_PREF_KEY, app);
}

export function openNavigation(lat: number, lon: number, app: NavApp): void {
    const url = app === 'maps' ? buildGoogleMapsUrl(lat, lon) : buildWazeUrl(lat, lon);
    window.open(url, '_blank', 'noopener,noreferrer');
}
