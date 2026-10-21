import { buildCsv } from "@/lib/export/csv";

describe("buildCsv", () => {
  it("writes a BOM, ';' separators and CRLF rows", () => {
    expect(buildCsv(["a", "b"], [["1", "2"]])).toBe("﻿a;b\r\n1;2\r\n");
  });
  it("quotes fields containing the separator, quotes or line breaks", () => {
    expect(buildCsv(["x"], [['he said "hi"; ok'], ["line\nbreak"]])).toBe(
      '﻿x\r\n"he said ""hi""; ok"\r\n"line\nbreak"\r\n',
    );
  });
});
