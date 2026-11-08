import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Prueba la compresión de la foto de evidencia del mapa comercial (bloque `nova-force-sales-evidence-image`):
// lectura y copia del EXIF, orientación normal, y que ante cualquier fallo se suba la original.
const html = await readFile(new URL('../public/maps/diseñoui_mapas_freelancers.html', import.meta.url), 'utf8');
const openTag = '<script id="nova-force-sales-evidence-image">';
const start = html.indexOf(openTag);
assert.ok(start >= 0, 'El mapa debe incluir el bloque de compresión de evidencia');
const source = html.slice(start + openTag.length, html.indexOf('</script>', start));

/** JPEG mínimo: SOI, (opcional JFIF), (opcional EXIF con orientación), carga y EOI. */
function buildJpeg({ jfif = false, exif = null, payloadBytes = 16 } = {}) {
  const parts = [Buffer.from([0xff, 0xd8])];
  if (jfif) parts.push(Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]));
  if (exif) {
    const little = exif.byteOrder !== 'MM';
    const u16 = (value) => { const bytes = Buffer.alloc(2); if (little) bytes.writeUInt16LE(value); else bytes.writeUInt16BE(value); return bytes; };
    const u32 = (value) => { const bytes = Buffer.alloc(4); if (little) bytes.writeUInt32LE(value); else bytes.writeUInt32BE(value); return bytes; };
    const entry = (tag, type, count, value) => Buffer.concat([u16(tag), u16(type), u32(count), type === 3 ? Buffer.concat([u16(value), u16(0)]) : u32(value)]);
    const tiff = Buffer.concat([
      Buffer.from(little ? 'II' : 'MM', 'latin1'), u16(42), u32(8),
      u16(2), entry(0x0112, 3, 1, exif.orientation), entry(0x8298, 4, 1, 0x1234), u32(0),
    ]);
    const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
    const length = Buffer.alloc(2);
    length.writeUInt16BE(body.length + 2);
    parts.push(Buffer.from([0xff, 0xe1]), length, body);
  }
  parts.push(Buffer.from([0xff, 0xda, 0x00, 0x04, 0x00, 0x00]), Buffer.alloc(payloadBytes, 7), Buffer.from([0xff, 0xd9]));
  return Buffer.concat(parts);
}

function createRuntime({ canvasBlobBytes, canvasReturnsNull = false, imageFails = false, naturalWidth = 4080, naturalHeight = 3060 } = {}) {
  const warnings = [];
  const draws = [];
  const sandbox = {
    window: {},
    File,
    Blob,
    Uint8Array,
    Promise,
    Math,
    console: { warn: (...args) => warnings.push(args) },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => undefined },
    Image: class {
      set src(_value) {
        this.naturalWidth = naturalWidth;
        this.naturalHeight = naturalHeight;
        queueMicrotask(() => (imageFails ? this.onerror?.() : this.onload?.()));
      }
    },
    document: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: (_image, x, y, width, height) => draws.push({ x, y, width, height }) }),
        toBlob(callback, type, quality) {
          draws.push({ encoded: type, quality });
          callback(canvasReturnsNull ? null : new Blob([canvasBlobBytes]));
        },
      }),
    },
  };
  vm.runInNewContext(source, sandbox, { filename: 'force-sales-evidence-image.js' });
  return { api: sandbox.window.NovaForceSalesEvidenceImage, warnings, draws };
}

const photoFile = (bytes, name = 'IMG_1.jpg', type = 'image/jpeg') => new File([bytes], name, { type, lastModified: 1_700_000_000_000 });
const bigPhoto = (orientation = 6, byteOrder = 'II') => {
  const header = buildJpeg({ jfif: true, exif: { orientation, byteOrder }, payloadBytes: 3 * 1024 * 1024 });
  return header;
};

// --- EXIF: lectura, orientación y copia ---------------------------------------------------------------------------
{
  const { api } = createRuntime({ canvasBlobBytes: buildJpeg() });
  const withJfifFirst = buildJpeg({ jfif: true, exif: { orientation: 6 } });
  const segment = api.exifSegment(new Uint8Array(withJfifFirst));
  assert.ok(segment, 'Encuentra el EXIF aunque venga después del bloque JFIF');
  assert.equal(segment[0], 0xff);
  assert.equal(segment[1], 0xe1);
  assert.equal(Buffer.from(segment.subarray(4, 10)).toString('latin1'), 'Exif\0\0');
  assert.equal(api.exifSegment(new Uint8Array(buildJpeg({ jfif: true }))), null, 'Sin EXIF devuelve null');
  assert.equal(api.exifSegment(new Uint8Array(Buffer.from('no es un jpeg'))), null);
  assert.equal(api.exifSegment(new Uint8Array(withJfifFirst.subarray(0, 24))), null, 'Un JPEG truncado no rompe la lectura');

  for (const byteOrder of ['II', 'MM']) {
    const original = api.exifSegment(new Uint8Array(buildJpeg({ exif: { orientation: 6, byteOrder } })));
    const normalized = api.withNormalOrientation(original);
    assert.equal(normalized.length, original.length, 'La longitud no cambia');
    const diffs = [];
    original.forEach((value, index) => { if (value !== normalized[index]) diffs.push(index); });
    assert.equal(diffs.length, 1, `Solo cambia un byte (orientación ${byteOrder}): ${diffs}`);
    // La etiqueta de orientación vale 1 y lo demás (p. ej. el otro dato del EXIF) queda igual
    const read = (bytes, index) => (byteOrder === 'II' ? bytes[index] | (bytes[index + 1] << 8) : (bytes[index] << 8) | bytes[index + 1]);
    assert.equal(read(original, 10 + 8 + 2 + 8), 6);
    assert.equal(read(normalized, 10 + 8 + 2 + 8), 1);
    assert.equal(original[diffs[0]], byteOrder === 'II' ? 6 : 6, 'El segmento original no se modifica');
  }

  const rebuilt = api.insertExif(new Uint8Array(buildJpeg({ jfif: true })), api.exifSegment(new Uint8Array(buildJpeg({ exif: { orientation: 3 } }))));
  assert.deepEqual([rebuilt[0], rebuilt[1], rebuilt[2], rebuilt[3]], [0xff, 0xd8, 0xff, 0xe1], 'El EXIF queda justo después del inicio del JPEG');
  assert.deepEqual([...rebuilt.subarray(rebuilt.length - 2)], [0xff, 0xd9], 'El resto del JPEG queda intacto');
}

// --- Compresión: reduce, conserva nombre, tipo y EXIF con orientación normal -------------------------------------
{
  const compressed = buildJpeg({ jfif: true, payloadBytes: 400 * 1024 });
  const { api, draws } = createRuntime({ canvasBlobBytes: compressed });
  const original = photoFile(bigPhoto(6));
  const result = await api.prepare(original);

  assert.notEqual(result, original, 'Una foto pesada se reemplaza por la comprimida');
  assert.equal(result.name, 'IMG_1.jpg', 'Conserva el nombre');
  assert.equal(result.type, 'image/jpeg', 'Conserva el tipo');
  assert.equal(result.lastModified, original.lastModified);
  assert.ok(result.size < original.size * 0.25, `Pesa mucho menos (${original.size} -> ${result.size})`);
  const drawn = draws.find((entry) => entry.width);
  assert.deepEqual([drawn.width, drawn.height], [1920, 1440], 'Reduce a 1920 px por el lado largo');

  const bytes = new Uint8Array(await result.arrayBuffer());
  const segment = api.exifSegment(bytes);
  assert.ok(segment, 'La foto comprimida conserva el EXIF');
  const orientation = api.withNormalOrientation(segment);
  assert.deepEqual([...orientation], [...segment], 'La orientación ya es normal (1): no se gira dos veces');
  assert.equal(segment[10 + 8 + 2 + 8], 1);
}

// --- Lo que no se debe tocar ----------------------------------------------------------------------------------------
{
  const { api } = createRuntime({ canvasBlobBytes: buildJpeg() });
  const small = photoFile(buildJpeg({ exif: { orientation: 1 }, payloadBytes: 200 * 1024 }));
  assert.equal(await api.prepare(small), small, 'Una foto de menos de 1 MB se sube como está');
  const png = photoFile(Buffer.alloc(3 * 1024 * 1024, 1), 'captura.png', 'image/png');
  assert.equal(await api.prepare(png), png, 'Solo se comprimen JPEG');
  const pdf = photoFile(Buffer.alloc(3 * 1024 * 1024, 1), 'doc.pdf', 'application/pdf');
  assert.equal(await api.prepare(pdf), pdf, 'Los PDF no se tocan');
  assert.equal(await api.prepare(null), null);
}

// --- Si algo falla se sube la original --------------------------------------------------------------------------------
{
  const original = photoFile(bigPhoto(6));
  const unreadable = createRuntime({ canvasBlobBytes: buildJpeg(), imageFails: true });
  assert.equal(await unreadable.api.prepare(original), original, 'Si no se puede leer la imagen, se sube la original');
  assert.equal(unreadable.warnings.length, 1, 'El fallo queda en la consola');

  const noBlob = createRuntime({ canvasBlobBytes: buildJpeg(), canvasReturnsNull: true });
  assert.equal(await noBlob.api.prepare(original), original, 'Si el navegador no entrega la imagen, se sube la original');

  const notSmaller = createRuntime({ canvasBlobBytes: Buffer.alloc(original.size) });
  assert.equal(await notSmaller.api.prepare(original), original, 'Si no ahorra al menos 25 %, se sube la original');
}

// --- Está conectado al flujo de subida ------------------------------------------------------------------------------
{
  const functionStart = html.indexOf('async function uploadEvidence(file){');
  assert.ok(functionStart >= 0, 'Existe uploadEvidence');
  const body = html.slice(functionStart, html.indexOf('async function flushOutbox', functionStart));
  const prepareAt = body.indexOf('window.NovaForceSalesEvidenceImage.prepare(file)');
  const requestAt = body.indexOf("'/storage/uploads/force-sales-evidence'");
  assert.ok(prepareAt >= 0 && requestAt > prepareAt, 'La foto se reduce ANTES de pedir la dirección de subida (el tamaño informado es el real)');
}

console.log('force-sales-evidence-image: lectura y copia del EXIF, orientación normal, reducción a 1920 px, archivos que no se tocan, respaldo ante fallos y conexión con la subida pasaron');
