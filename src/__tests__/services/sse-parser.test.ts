import { SseFrameParser, decodeUtf8 } from '../../../services/sse-parser';

const bytes = (text: string) => new Uint8Array(Buffer.from(text, 'utf8'));

function isSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdfff;
}

describe('decodeUtf8', () => {
  it('decodifica ASCII', () => {
    expect(decodeUtf8(bytes('hola'))).toBe('hola');
  });

  it('decodifica caracteres de 2, 3 y 4 bytes (texto español + emoji)', () => {
    expect(decodeUtf8(bytes('acción — ok 🚀'))).toBe('acción — ok 🚀');
  });

  it('reemplaza bytes inválidos en vez de lanzar', () => {
    const invalid = new Uint8Array([0xff, 0xfe, 0x61]);
    expect(decodeUtf8(invalid)).toBe('\uFFFD\uFFFDa');
  });

  it('reemplaza una secuencia incompleta al final', () => {
    // Arranque de un emoji (4 bytes) con solo 2 presentes
    const partial = new Uint8Array([0x61, 0xf0, 0x9f]);
    expect(decodeUtf8(partial)).toBe('a\uFFFD');
  });

  it('no produce surrogates sueltos (secuencia sobrelong)', () => {
    const overlong = new Uint8Array([0xed, 0xa0, 0x80]); // U+D800 codificado
    const decoded = decodeUtf8(overlong);
    expect(decoded).toBe('\uFFFD');
    expect(isSurrogate(decoded.charCodeAt(0))).toBe(false);
  });
});

describe('SseFrameParser', () => {
  it('extrae event, id y data de un frame completo', () => {
    const parser = new SseFrameParser();
    const messages = parser.push(
      bytes('id: 1000-1\nevent: delivery-created\ndata: {"a":1}\n\n'),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      event: 'delivery-created',
      data: '{"a":1}',
      id: '1000-1',
    });
    expect(parser.getLastEventId()).toBe('1000-1');
  });

  it('reconstruye frames partidos byte a byte (chunking de red)', () => {
    const parser = new SseFrameParser();
    const raw = 'id: 1-1\nevent: x\ndata: {"n":1}\n\n';
    const all = bytes(raw);
    const received = [];

    for (const byte of all) {
      received.push(...parser.push(new Uint8Array([byte])));
    }

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ event: 'x', data: '{"n":1}' });
  });

  it('acepta finales de línea CRLF', () => {
    const parser = new SseFrameParser();
    const messages = parser.push(bytes('event: a\r\ndata: hola\r\n\r\n'));

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ event: 'a', data: 'hola' });
  });

  it('ignora los comentarios (keep-alive `: ping`)', () => {
    const parser = new SseFrameParser();
    expect(parser.push(bytes(': ping 1730000000000\n\n'))).toHaveLength(0);
  });

  it('ignora el frame inicial que solo trae `retry:`', () => {
    const parser = new SseFrameParser();
    expect(parser.push(bytes('retry: 3000\n: connected\n\n'))).toHaveLength(0);
    expect(parser.getRetryMs()).toBe(3000);
  });

  it('une varias líneas `data:` con salto de línea', () => {
    const parser = new SseFrameParser();
    const messages = parser.push(bytes('data: linea1\ndata: linea2\n\n'));

    expect(messages).toHaveLength(1);
    expect(messages[0].data).toBe('linea1\nlinea2');
  });

  it('usa `message` como tipo por defecto y tolera campos desconocidos', () => {
    const parser = new SseFrameParser();
    const messages = parser.push(bytes('campo-ignorado: x\ndata: 1\n\n'));

    expect(messages[0].event).toBe('message');
    expect(messages[0].data).toBe('1');
  });

  it('decodifica acentos dentro del payload', () => {
    const parser = new SseFrameParser();
    const messages = parser.push(bytes('data: {"message":"Entrega reordenada"}\n\n'));

    expect(JSON.parse(messages[0].data).message).toBe('Entrega reordenada');
  });

  it('mantiene el lastEventId entre frames (para reenviarlo al reconectar)', () => {
    const parser = new SseFrameParser();
    parser.push(bytes('id: 5-5\ndata: uno\n\n'));
    parser.push(bytes('data: dos\n\n'));

    expect(parser.getLastEventId()).toBe('5-5');
  });
});
