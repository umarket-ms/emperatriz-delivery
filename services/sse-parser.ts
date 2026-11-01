/**
 * Parser de Server-Sent Events.
 *
 * Implementa la gramatura de SSE
 * (https://html.spec.whatwg.org/multipage/server-sent-events.html) sin
 * depender de `EventSource`, que React Native no trae.
 *
 * Dos detalles que hacen falta en movil:
 *  - El stream llega en trozos de bytes que pueden partirse en cualquier
 *    sitio; solo se decodifica UTF-8 cuando la linea esta completa. Es seguro
 *    porque los bytes de fin de linea (0x0A/0x0D) nunca forman parte de una
 *    secuencia multibyte UTF-8.
 *  - Los comentarios (`: ping`) y los frames sin `data` no se entregan: son
 *    keep-alives, no eventos.
 */

const REPLACEMENT = '\uFFFD';

/** Decodifica UTF-8 de forma autonoma (Hermes no trae `TextDecoder`). */
export function decodeUtf8(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  const len = bytes.length;

  while (i < len) {
    const b0 = bytes[i];

    // ASCII
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
      i += 1;
      continue;
    }

    let codePoint: number;
    let continuation: number;

    if ((b0 & 0xe0) === 0xc0) {
      codePoint = b0 & 0x1f;
      continuation = 1;
    } else if ((b0 & 0xf0) === 0xe0) {
      codePoint = b0 & 0x0f;
      continuation = 2;
    } else if ((b0 & 0xf8) === 0xf0) {
      codePoint = b0 & 0x07;
      continuation = 3;
    } else {
      // Byte de arranque invalido (continuacion suelta o 5-6 bytes): se
      // emite un reemplazo y se salta la tanda de bytes de continuacion que
      // lo acompanan (asi no se genera un reemplazo por cada byte).
      out += REPLACEMENT;
      i += 1;
      while (i < len && (bytes[i] & 0xc0) === 0x80) i += 1;
      continue;
    }

    if (i + continuation >= len) {
      // Secuencia incompleta: no deberia pasar (solo se decodifican lineas
      // completas), pero no emitimos caracteres corruptos.
      out += REPLACEMENT;
      break;
    }

    let valid = true;
    for (let k = 1; k <= continuation; k++) {
      const b = bytes[i + k];
      if ((b & 0xc0) !== 0x80) {
        valid = false;
        break;
      }
      codePoint = (codePoint << 6) | (b & 0x3f);
    }

    // Descarta sobrelongs invalidos, surrogates y fuera de rango.
    if (
      !valid ||
      codePoint > 0x10ffff ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      out += REPLACEMENT;
      i += 1;
      while (i < len && (bytes[i] & 0xc0) === 0x80) i += 1;
      continue;
    }

    out += String.fromCodePoint(codePoint);
    i += continuation + 1;
  }

  return out;
}

export interface SseMessage {
  /** Nombre del evento (`event:`); `message` si el servidor no lo define. */
  event: string;
  /** Payload textual (normalmente JSON del backend). */
  data: string;
  /** Ultimo `id:` visto; se reenvia como `Last-Event-ID` al reconectar. */
  id?: string;
  /** `retry:` — sugerencia de espera de reconexion, en ms. */
  retry?: number;
}

export class SseFrameParser {
  private buffer: Uint8Array = new Uint8Array(0);
  private event = '';
  private dataLines: string[] = [];
  private lastEventId: string | undefined;
  private retryMs: number | undefined;

  /**
   * Alimenta el parser con un trozo del stream y devuelve los eventos
   * completos detectados hasta ahora.
   */
  push(chunk: Uint8Array): SseMessage[] {
    const merged = new Uint8Array(this.buffer.length + chunk.length);
    merged.set(this.buffer, 0);
    merged.set(chunk, this.buffer.length);
    this.buffer = merged;

    const messages: SseMessage[] = [];
    let lineStart = 0;
    let i = 0;

    while (i < this.buffer.length) {
      const byte = this.buffer[i];

      if (byte !== 0x0a && byte !== 0x0d) {
        i += 1;
        continue;
      }

      let next = i + 1;
      if (byte === 0x0d) {
        if (this.buffer[i + 1] === 0x0a) {
          // CRLF
          next = i + 2;
        } else if (i + 1 >= this.buffer.length) {
          // El LF puede venir en el siguiente trozo: esperamos.
          break;
        }
      }

      const line = decodeUtf8(this.buffer.subarray(lineStart, i));
      const message = this.handleLine(line);
      if (message) messages.push(message);

      lineStart = next;
      i = next;
    }

    this.buffer = lineStart > 0 ? this.buffer.slice(lineStart) : this.buffer;
    return messages;
  }

  getLastEventId(): string | undefined {
    return this.lastEventId;
  }

  getRetryMs(): number | undefined {
    return this.retryMs;
  }

  /** Limpia el estado de linea (NO el `lastEventId`: hace falta al reconectar). */
  reset(): void {
    this.buffer = new Uint8Array(0);
    this.event = '';
    this.dataLines = [];
  }

  private handleLine(line: string): SseMessage | null {
    // Linea en blanco -> fin de evento.
    if (line === '') {
      if (this.dataLines.length === 0) {
        // Sin `data:` no se dispara nada: asi se ignoran los keep-alives
        // (`: ping`) y el frame inicial que solo trae `retry:`.
        this.event = '';
        return null;
      }

      const message: SseMessage = {
        event: this.event || 'message',
        data: this.dataLines.join('\n'),
        id: this.lastEventId,
        retry: this.retryMs,
      };
      this.event = '';
      this.dataLines = [];
      return message;
    }

    // Comentario (keep-alive del servidor).
    if (line.startsWith(':')) return null;

    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? '' : line.slice(separator + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    switch (field) {
      case 'event':
        this.event = value;
        break;
      case 'data':
        this.dataLines.push(value);
        break;
      case 'id':
        if (!value.includes('\u0000')) this.lastEventId = value;
        break;
      case 'retry': {
        const ms = Number(value);
        if (Number.isFinite(ms) && ms >= 0) this.retryMs = ms;
        break;
      }
      default:
        // Campos desconocidos se ignoran (spec).
        break;
    }

    return null;
  }
}
