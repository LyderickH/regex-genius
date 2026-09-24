import { describe, it, expect, vi } from "vitest";
import { parsePastedDataset, exportFullDatasetStreaming } from "../data-io";

describe("Dataset Sampling & Full Streaming Export", () => {
  it("échantillonne correctement un texte de plus de 50 000 lignes", () => {
    // 60 000 lignes
    const raw = ("line_sample_test\n").repeat(60000);
    const parsed = parsePastedDataset(raw, 50000);

    expect(parsed.totalLines).toBe(60000);
    expect(parsed.isSampled).toBe(true);
    expect(parsed.matrix.length).toBe(50000);
    expect(parsed.rawText).toBeDefined();
  });

  it("garde toutes les lignes si inférieur à 50 000 lignes", () => {
    const raw = ("line_sample_test\n").repeat(100);
    const parsed = parsePastedDataset(raw, 50000);

    expect(parsed.totalLines).toBe(100);
    expect(parsed.isSampled).toBe(false);
    expect(parsed.matrix.length).toBe(100);
    expect(parsed.rawText).toBeUndefined();
  });

  it("exportFullDatasetStreaming applique la regex déduite sur l'ensemble des lignes", async () => {
    const totalLines = 1000;
    const raw = Array.from({ length: totalLines }, (_, i) => `user_${i}: <email_${i}@corp.org> logged`).join("\n");
    const header = ["Source", "Email"];
    const columns = [
      {
        name: "Email",
        rule: {
          source: "<([^>]+)>",
          flags: "",
          transform: { strip: "none", dec: "none", casing: "none", fmt: "none" } as const,
        },
      },
    ];

    let lastProgress = 0;
    const originalCreateObjectURL = global.URL.createObjectURL;
    const originalRevokeObjectURL = global.URL.revokeObjectURL;
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();

    const originalDocument = (global as any).document;
    (global as any).document = {
      createElement: vi.fn(() => ({
        href: "",
        download: "",
        click: vi.fn(),
      })),
    };

    await exportFullDatasetStreaming({
      rawText: raw,
      totalLines,
      header,
      columns,
      onProgress: (p) => {
        lastProgress = p;
      },
    });

    expect(lastProgress).toBe(100);
    expect(global.URL.createObjectURL).toHaveBeenCalled();

    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
    (global as any).document = originalDocument;
  });

  it("parseFileDataset émet des rapports de progression via onProgress", async () => {
    const { parseFileDataset } = await import("../data-io");
    const blob = new Blob(["id;name\n1;alice\n2;bob\n"], { type: "text/csv" });
    const file = new File([blob], "test.csv", { type: "text/csv" });

    const progressReports: { percent: number; step: string }[] = [];
    const parsed = await parseFileDataset(file, 50000, (p) => {
      progressReports.push(p);
    });

    expect(parsed.matrix.length).toBe(3); // header + 2 rows
    expect(progressReports.length).toBeGreaterThan(0);
    expect(progressReports[progressReports.length - 1]?.percent).toBe(100);
  });
});
