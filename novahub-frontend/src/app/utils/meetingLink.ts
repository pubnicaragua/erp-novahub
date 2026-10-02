export function detectMeetingUrl(text?: string | null): { url: string; platform: 'GOOGLE_MEET' | 'TEAMS' | 'ZOOM' } | null {
  if (!text) return null;

  // Google Meet: meet.google.com/xxx-yyyy-zzz or google.com/meet/xxx
  const meetMatch = text.match(/(https?:\/\/meet\.google\.com\/[a-zA-Z0-9-]+)/i);
  if (meetMatch) return { url: meetMatch[1], platform: 'GOOGLE_MEET' };

  // Microsoft Teams: teams.microsoft.com/... or teams.live.com/...
  const teamsMatch = text.match(/(https?:\/\/(?:teams\.microsoft\.com|teams\.live\.com)\/[^\s]+)/i);
  if (teamsMatch) return { url: teamsMatch[1], platform: 'TEAMS' };

  // Zoom: zoom.us/j/... or zoom.com/j/... or zoom.us/my/...
  const zoomMatch = text.match(/(https?:\/\/(?:[a-zA-Z0-9-]+\.)?zoom\.(?:us|com)\/(?:j|my)\/[^\s]+)/i);
  if (zoomMatch) return { url: zoomMatch[1], platform: 'ZOOM' };

  return null;
}
