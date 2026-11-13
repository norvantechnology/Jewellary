/** Client-only record of the previous in-app route (path + query), updated by NavigationProgress. */
let previousRoute: string | null = null;
let currentRoute: string | null = null;

export function recordRoute(route: string) {
  if (route === currentRoute) return;
  previousRoute = currentRoute;
  currentRoute = route;
}

export function getPreviousRoute(): string | null {
  return previousRoute;
}
