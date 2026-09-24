import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import * as path from "node:path";
import { synthesize } from "../engine";

describe("Dataset 1000 Audit Logs Example", () => {
  it("synthesizes regex for Email, ISO Date, and Secure Token", () => {
    const filePath = path.resolve(process.cwd(), "regex_dataset_1000 exemple.xlsx");
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    const rows = rawData.slice(1).map((r) => String(r[1] ?? ""));

    expect(rows.length).toBeGreaterThanOrEqual(1000);

    // 1. Email synthesis
    const emailUser = rows.map((_, i) =>
      i === 0 ? "admin.1@sub.network-2.net" : i === 1 ? "service.worker_2@cloud-3.io" : null
    );
    const emailSynth = synthesize(rows, emailUser);
    expect(emailSynth.rule).not.toBeNull();
    expect(emailSynth.values[0]).toBe("admin.1@sub.network-2.net");
    expect(emailSynth.values[1]).toBe("service.worker_2@cloud-3.io");
    expect(emailSynth.values[2]).toBe("contact+3@domain-4.fr");
    expect(emailSynth.matched).toBeGreaterThanOrEqual(1000);

    // 2. Token synthesis
    const tokenUser = rows.map((_, i) =>
      i === 0 ? "TK#4b-1E_1!w&42" : i === 1 ? "TK#7c-8D_2!z%11" : null
    );
    const tokenSynth = synthesize(rows, tokenUser);
    expect(tokenSynth.rule).not.toBeNull();
    expect(tokenSynth.values[0]).toBe("TK#4b-1E_1!w&42");
    expect(tokenSynth.values[1]).toBe("TK#7c-8D_2!z%11");

    // 3. Date synthesis
    const dateUser = rows.map((_, i) =>
      i === 0 ? "2026-02-02 01:01:01" : i === 1 ? "2026-03-03T02:02:02+02:00" : null
    );
    const dateSynth = synthesize(rows, dateUser);
    expect(dateSynth.rule).not.toBeNull();
    expect(dateSynth.values[0]).toBe("2026-02-02 01:01:01");
    expect(dateSynth.values[1]).toBe("2026-03-03T02:02:02+02:00");
  });
});
