export const panelDomain = process.env.NEXT_PUBLIC_PANEL_DOMAIN || 'localhost';
export const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
export const adminerUrl = `https://db.${panelDomain}`;
export const fileBrowserBaseUrl = `https://files.${panelDomain}`;
export const gdriveBackupFolder = `VPS-${panelDomain.replace(/\./g, '-')}-backups`;
