declare module "rtf-parser" {
  export interface RtfSpan {
    value?: string;
  }

  export interface RtfParagraph {
    content?: RtfSpan[];
  }

  export interface RtfDocument {
    content: RtfParagraph[];
  }

  type ParseCallback = (error: Error | null, document?: RtfDocument) => void;

  interface RtfParser {
    (callback: ParseCallback): NodeJS.ReadWriteStream;
    string(input: string | Buffer, callback: ParseCallback): void;
    stream(input: NodeJS.ReadableStream, callback: ParseCallback): void;
  }

  const parseRTF: RtfParser;
  export = parseRTF;
}
