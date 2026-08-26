type SqliteValue = null | number | bigint | string | Uint8Array;

export type SqliteTable = {
  name: string;
  columns: string[];
  rows: SqliteValue[][];
};

type WalOverlay = Map<number, Uint8Array>;

function readU16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  ) >>> 0;
}

function readSigned(bytes: Uint8Array, offset: number, length: number): number | bigint {
  let value = 0n;
  for (let index = 0; index < length; index += 1) {
    value = (value << 8n) | BigInt(bytes[offset + index]);
  }
  const bits = BigInt(length * 8);
  if (value & (1n << (bits - 1n))) {
    value -= 1n << bits;
  }
  if (value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }
  return value;
}

function readVarint(bytes: Uint8Array, offset: number): { value: bigint; next: number } {
  let value = 0n;
  for (let index = 0; index < 9; index += 1) {
    const byte = bytes[offset + index];
    if (index === 8) {
      value = (value << 8n) | BigInt(byte);
      return { value, next: offset + index + 1 };
    }
    value = (value << 7n) | BigInt(byte & 0x7f);
    if ((byte & 0x80) === 0) {
      return { value, next: offset + index + 1 };
    }
  }
  throw new Error("Invalid SQLite varint.");
}

function toSafeNumber(value: bigint, label: string): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} is outside the supported range.`);
  }
  return Number(value);
}

function decodeText(bytes: Uint8Array, encoding: number): string {
  if (encoding === 2) return new TextDecoder("utf-16le").decode(bytes);
  if (encoding === 3) {
    const swapped = new Uint8Array(bytes.length);
    for (let index = 0; index + 1 < bytes.length; index += 2) {
      swapped[index] = bytes[index + 1];
      swapped[index + 1] = bytes[index];
    }
    return new TextDecoder("utf-16le").decode(swapped);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function splitCreateTableColumns(sql: string): string[] {
  const open = sql.indexOf("(");
  const close = sql.lastIndexOf(")");
  if (open < 0 || close <= open) return [];

  const source = sql.slice(open + 1, close);
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      current += char;
      if (char === quote) {
        if (source[index + 1] === quote) {
          current += source[index + 1];
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`" || char === "[") {
      quote = char === "[" ? "]" : char;
      current += char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());

  return parts
    .filter((part) => !/^(constraint|primary\s+key|unique|check|foreign\s+key)\b/i.test(part))
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return "";
      if (trimmed[0] === '"' || trimmed[0] === "`" || trimmed[0] === "[") {
        const end = trimmed[0] === "[" ? "]" : trimmed[0];
        const closeIndex = trimmed.indexOf(end, 1);
        return closeIndex > 0 ? trimmed.slice(1, closeIndex) : "";
      }
      return trimmed.split(/\s+/)[0] ?? "";
    })
    .filter(Boolean);
}


function integerPrimaryKeyIndex(sql: string, columns: string[]): number | null {
  const open = sql.indexOf("(");
  const close = sql.lastIndexOf(")");
  if (open < 0 || close <= open) return null;
  const source = sql.slice(open + 1, close);
  const definitions: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`" || char === "[") {
      quote = char === "[" ? "]" : char;
      current += char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      definitions.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) definitions.push(current.trim());

  for (const definition of definitions) {
    if (!/\binteger\b/i.test(definition) || !/\bprimary\s+key\b/i.test(definition)) continue;
    const first = definition.match(/^\s*(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([^\s]+))/);
    const name = first?.[1] ?? first?.[2] ?? first?.[3] ?? first?.[4] ?? "";
    const index = columns.findIndex((column) => column.toLowerCase() === name.toLowerCase());
    if (index >= 0) return index;
  }
  return null;
}

function parseWal(walBytes: Uint8Array | null, expectedPageSize: number): WalOverlay {
  const pages = new Map<number, Uint8Array>();
  if (!walBytes || walBytes.length < 32) return pages;

  const magic = readU32(walBytes, 0);
  if (magic !== 0x377f0682 && magic !== 0x377f0683) return pages;

  const walPageSizeRaw = readU32(walBytes, 8);
  const walPageSize = walPageSizeRaw === 0 ? 65536 : walPageSizeRaw;
  if (walPageSize !== expectedPageSize) return pages;

  const frameSize = 24 + walPageSize;
  const frameCount = Math.floor((walBytes.length - 32) / frameSize);
  let lastCommitFrame = -1;
  for (let index = 0; index < frameCount; index += 1) {
    const frameOffset = 32 + index * frameSize;
    if (readU32(walBytes, frameOffset + 4) !== 0) lastCommitFrame = index;
  }
  const upperBound = lastCommitFrame >= 0 ? lastCommitFrame : frameCount - 1;

  for (let index = 0; index <= upperBound; index += 1) {
    const frameOffset = 32 + index * frameSize;
    const pageNumber = readU32(walBytes, frameOffset);
    if (pageNumber === 0) continue;
    pages.set(
      pageNumber,
      walBytes.slice(frameOffset + 24, frameOffset + 24 + walPageSize),
    );
  }
  return pages;
}

export class SqliteReader {
  private readonly bytes: Uint8Array;
  private readonly pageSize: number;
  private readonly usableSize: number;
  private readonly encoding: number;
  private readonly walOverlay: WalOverlay;

  constructor(
    bytes: Uint8Array,
    walBytes: Uint8Array | null = null,
  ) {
    this.bytes = bytes;
    const signature = new TextDecoder("ascii").decode(bytes.slice(0, 16));
    if (signature !== "SQLite format 3\u0000") {
      throw new Error("The selected file is not a SQLite 3 database.");
    }
    const rawPageSize = readU16(bytes, 16);
    this.pageSize = rawPageSize === 1 ? 65536 : rawPageSize;
    this.usableSize = this.pageSize - bytes[20];
    this.encoding = readU32(bytes, 56) || 1;
    this.walOverlay = parseWal(walBytes, this.pageSize);
  }

  private page(pageNumber: number): Uint8Array {
    const overlay = this.walOverlay.get(pageNumber);
    if (overlay) return overlay;
    const start = (pageNumber - 1) * this.pageSize;
    const end = start + this.pageSize;
    if (pageNumber <= 0 || start < 0 || end > this.bytes.length) {
      throw new Error(`SQLite page ${pageNumber} is unavailable.`);
    }
    return this.bytes.slice(start, end);
  }

  private payloadFromCell(
    page: Uint8Array,
    payloadStart: number,
    payloadSize: number,
    pageType: 0x0d | 0x0a | 0x02,
  ): Uint8Array {
    const minLocal = Math.floor(((this.usableSize - 12) * 32) / 255) - 23;
    const maxLocal = pageType === 0x0d
      ? this.usableSize - 35
      : Math.floor(((this.usableSize - 12) * 64) / 255) - 23;

    let local = payloadSize;
    if (payloadSize > maxLocal) {
      local = minLocal + ((payloadSize - minLocal) % (this.usableSize - 4));
      if (local > maxLocal) local = minLocal;
    }

    if (payloadStart + local > page.length) {
      throw new Error("SQLite record payload is truncated.");
    }

    const chunks: Uint8Array[] = [page.slice(payloadStart, payloadStart + local)];
    let remaining = payloadSize - local;
    let overflowPage = 0;
    if (remaining > 0) {
      if (payloadStart + local + 4 > page.length) {
        throw new Error("SQLite overflow pointer is truncated.");
      }
      overflowPage = readU32(page, payloadStart + local);
    }

    const seen = new Set<number>();
    while (remaining > 0 && overflowPage !== 0) {
      if (seen.has(overflowPage)) throw new Error("SQLite overflow page cycle detected.");
      seen.add(overflowPage);
      const overflow = this.page(overflowPage);
      const take = Math.min(remaining, this.usableSize - 4);
      chunks.push(overflow.slice(4, 4 + take));
      remaining -= take;
      overflowPage = readU32(overflow, 0);
    }
    if (remaining > 0) throw new Error("SQLite overflow payload is incomplete.");

    const result = new Uint8Array(payloadSize);
    let cursor = 0;
    for (const chunk of chunks) {
      result.set(chunk, cursor);
      cursor += chunk.length;
    }
    return result;
  }

  private payloadFromTableLeafCell(page: Uint8Array, cellOffset: number): { payload: Uint8Array; rowId: number | bigint } {
    const payloadSizeVarint = readVarint(page, cellOffset);
    const payloadSize = toSafeNumber(payloadSizeVarint.value, "SQLite payload size");
    const rowIdVarint = readVarint(page, payloadSizeVarint.next);
    const rowId = rowIdVarint.value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(rowIdVarint.value)
      : rowIdVarint.value;
    return {
      payload: this.payloadFromCell(page, rowIdVarint.next, payloadSize, 0x0d),
      rowId,
    };
  }

  private payloadFromIndexCell(
    page: Uint8Array,
    cellOffset: number,
    pageType: 0x0a | 0x02,
  ): Uint8Array {
    const payloadSizeOffset = pageType === 0x02 ? cellOffset + 4 : cellOffset;
    const payloadSizeVarint = readVarint(page, payloadSizeOffset);
    const payloadSize = toSafeNumber(payloadSizeVarint.value, "SQLite index payload size");
    return this.payloadFromCell(page, payloadSizeVarint.next, payloadSize, pageType);
  }

  private parseRecord(payload: Uint8Array): SqliteValue[] {
    const headerSizeVarint = readVarint(payload, 0);
    const headerSize = toSafeNumber(headerSizeVarint.value, "SQLite record header size");
    const serialTypes: bigint[] = [];
    let headerOffset = headerSizeVarint.next;
    while (headerOffset < headerSize) {
      const serial = readVarint(payload, headerOffset);
      serialTypes.push(serial.value);
      headerOffset = serial.next;
    }

    let bodyOffset = headerSize;
    const values: SqliteValue[] = [];
    for (const serialTypeBig of serialTypes) {
      const serialType = toSafeNumber(serialTypeBig, "SQLite serial type");
      if (serialType === 0) {
        values.push(null);
      } else if (serialType >= 1 && serialType <= 6) {
        const lengths = [0, 1, 2, 3, 4, 6, 8];
        const length = lengths[serialType];
        values.push(readSigned(payload, bodyOffset, length));
        bodyOffset += length;
      } else if (serialType === 7) {
        const view = new DataView(payload.buffer, payload.byteOffset + bodyOffset, 8);
        values.push(view.getFloat64(0, false));
        bodyOffset += 8;
      } else if (serialType === 8) {
        values.push(0);
      } else if (serialType === 9) {
        values.push(1);
      } else if (serialType === 10 || serialType === 11) {
        values.push(null);
      } else {
        const isText = serialType % 2 === 1;
        const length = isText ? (serialType - 13) / 2 : (serialType - 12) / 2;
        const slice = payload.slice(bodyOffset, bodyOffset + length);
        values.push(isText ? decodeText(slice, this.encoding) : slice);
        bodyOffset += length;
      }
    }
    return values;
  }

  private collectTableRows(rootPage: number, integerPrimaryKeyColumn: number | null = null): SqliteValue[][] {
    const rows: SqliteValue[][] = [];
    const visit = (pageNumber: number) => {
      const page = this.page(pageNumber);
      const headerOffset = pageNumber === 1 ? 100 : 0;
      const pageType = page[headerOffset];
      const cellCount = readU16(page, headerOffset + 3);
      const isInteriorPage = pageType === 0x05 || pageType === 0x02;
      const cellPointerStart = headerOffset + (isInteriorPage ? 12 : 8);

      if (pageType === 0x0d) {
        for (let index = 0; index < cellCount; index += 1) {
          const cellOffset = readU16(page, cellPointerStart + index * 2);
          const cell = this.payloadFromTableLeafCell(page, cellOffset);
          const values = this.parseRecord(cell.payload);
          if (integerPrimaryKeyColumn !== null && values[integerPrimaryKeyColumn] === null) {
            values[integerPrimaryKeyColumn] = cell.rowId;
          }
          rows.push(values);
        }
        return;
      }

      if (pageType === 0x05) {
        for (let index = 0; index < cellCount; index += 1) {
          const cellOffset = readU16(page, cellPointerStart + index * 2);
          visit(readU32(page, cellOffset));
        }
        visit(readU32(page, headerOffset + 8));
        return;
      }

      // WITHOUT ROWID tables use an index B-tree instead of the normal table B-tree.
      // Index leaf pages (0x0a) store complete records without a rowid.
      if (pageType === 0x0a) {
        for (let index = 0; index < cellCount; index += 1) {
          const cellOffset = readU16(page, cellPointerStart + index * 2);
          rows.push(this.parseRecord(this.payloadFromIndexCell(page, cellOffset, 0x0a)));
        }
        return;
      }

      // Interior index pages (0x02) contain both child pointers and record payloads.
      // The payloads are real index/table records, so collect them as well as traversing children.
      if (pageType === 0x02) {
        for (let index = 0; index < cellCount; index += 1) {
          const cellOffset = readU16(page, cellPointerStart + index * 2);
          visit(readU32(page, cellOffset));
          rows.push(this.parseRecord(this.payloadFromIndexCell(page, cellOffset, 0x02)));
        }
        visit(readU32(page, headerOffset + 8));
        return;
      }

      throw new Error(`Unsupported SQLite B-tree page type 0x${pageType.toString(16)}.`);
    };

    visit(rootPage);
    return rows;
  }

  tables(): SqliteTable[] {
    const masterRows = this.collectTableRows(1);
    const tables: SqliteTable[] = [];
    for (const row of masterRows) {
      const type = row[0];
      const name = row[1];
      const rootPage = row[3];
      const sql = row[4];
      if (type !== "table" || typeof name !== "string" || typeof sql !== "string") continue;
      if (name.startsWith("sqlite_")) continue;
      if (typeof rootPage !== "number" || rootPage <= 0) continue;
      const columns = splitCreateTableColumns(sql);
      tables.push({
        name,
        columns,
        rows: this.collectTableRows(rootPage, integerPrimaryKeyIndex(sql, columns)),
      });
    }
    return tables;
  }

  table(name: string): SqliteTable | null {
    return this.tables().find((table) => table.name.toLowerCase() === name.toLowerCase()) ?? null;
  }
}
