// normalizes ISO strings to avoid milliseconds differences, always UTC on server
export const toISO = (d: string | Date) => new Date(d).toISOString();
