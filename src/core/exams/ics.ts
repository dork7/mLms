// Writes an iCalendar (RFC 5545) file: CRLF line ends, text escaped, lines folded at 75 octets.

export type IcsEvent = { uid: string; start: Date; end: Date; summary: string; location: string };

export function icsCalendar(now: Date, events: IcsEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//School LMS//Exam schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${escapeText(event.uid)}`,
      `DTSTAMP:${utc(now)}`,
      `DTSTART:${utc(event.start)}`,
      `DTEND:${utc(event.end)}`,
      `SUMMARY:${escapeText(event.summary)}`,
      `LOCATION:${escapeText(event.location)}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** 20261110T050000Z */
function utc(instant: Date): string {
  return instant.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Continuation lines start with a space, which counts towards their 75 octets. */
function fold(line: string): string {
  const folded: string[] = [];
  let current = "";
  let octets = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character);
    if (octets + size > 75) {
      folded.push(current);
      current = " ";
      octets = 1;
    }
    current += character;
    octets += size;
  }
  folded.push(current);
  return folded.join("\r\n");
}
