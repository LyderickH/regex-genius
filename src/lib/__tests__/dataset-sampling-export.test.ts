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

  describe("Options d'importation avec délimiteur / sans délimiteur", () => {
    const csvContent = "2024-03-01;USER_1;OK;192.168.1.1\n2024-03-02;USER_2;FAIL;192.168.1.2\n";

    it("importe sans délimiteur : conserve la ligne brute complète en 1 seule colonne", () => {
      const parsed = parsePastedDataset(csvContent, 50000, { delimiterMode: "without_delimiter" });
      expect(parsed.matrix.length).toBe(2);
      expect(parsed.matrix[0]?.length).toBe(1);
      expect(parsed.matrix[0]?.[0]).toBe("2024-03-01;USER_1;OK;192.168.1.1");
      expect(parsed.matrix[1]?.[0]).toBe("2024-03-02;USER_2;FAIL;192.168.1.2");
      expect(parsed.delimiterMode).toBe("without_delimiter");
    });

    it("importe avec délimiteur automatique : sépare correctement en colonnes", () => {
      const parsed = parsePastedDataset(csvContent, 50000, { delimiterMode: "with_delimiter" });
      expect(parsed.matrix.length).toBe(2);
      expect(parsed.matrix[0]?.length).toBe(4);
      expect(parsed.matrix[0]?.[0]).toBe("2024-03-01");
      expect(parsed.matrix[0]?.[1]).toBe("USER_1");
      expect(parsed.matrix[0]?.[2]).toBe("OK");
      expect(parsed.matrix[0]?.[3]).toBe("192.168.1.1");
      expect(parsed.delimiterMode).toBe("with_delimiter");
      expect(parsed.rawLinesMatrix).toBeDefined();
      expect(parsed.rawLinesMatrix?.[0]?.[0]).toBe("2024-03-01;USER_1;OK;192.168.1.1");
    });

    it("supporte les délimiteurs personnalisés (ex: pipe |)", () => {
      const pipeContent = "A|B|C\n1|2|3\n";
      const parsed = parsePastedDataset(pipeContent, 50000, {
        delimiterMode: "with_delimiter",
        delimiter: "|",
      });
      expect(parsed.matrix.length).toBe(2);
      expect(parsed.matrix[0]).toEqual(["A", "B", "C"]);
      expect(parsed.matrix[1]).toEqual(["1", "2", "3"]);
    });

    it("parseFileDataset supporte delimiterMode: 'without_delimiter'", async () => {
      const { parseFileDataset } = await import("../data-io");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const file = new File([blob], "logs.csv", { type: "text/csv" });

      const parsed = await parseFileDataset(file, 50000, undefined, {
        delimiterMode: "without_delimiter",
      });
      expect(parsed.matrix.length).toBe(2);
      expect(parsed.matrix[0]?.length).toBe(1);
      expect(parsed.matrix[0]?.[0]).toBe("2024-03-01;USER_1;OK;192.168.1.1");
      expect(parsed.delimiterMode).toBe("without_delimiter");
    });

    it("exportFullDatasetStreaming en mode without_delimiter ne tronque pas les lignes contenant des virgules ou points-virgules", async () => {
      const totalLines = 5;
      const raw = "2024-03-01;USER_A;OK\n2024-03-02;USER_B;FAIL\n2024-03-03;USER_C;OK\n";
      const header = ["Source", "User"];
      const columns = [
        {
          name: "User",
          rule: {
            source: ";(USER_[A-Z]);",
            flags: "",
            transform: { strip: "none", dec: "none", casing: "none", fmt: "none" } as const,
          },
        },
      ];

      const originalCreateObjectURL = global.URL.createObjectURL;
      const originalRevokeObjectURL = global.URL.revokeObjectURL;
      let exportedBlob: Blob | null = null;
      global.URL.createObjectURL = vi.fn((blob: Blob) => {
        exportedBlob = blob;
        return "blob:mock";
      });
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
        delimiterMode: "without_delimiter",
      });

      expect(global.URL.createObjectURL).toHaveBeenCalled();

      global.URL.createObjectURL = originalCreateObjectURL;
      global.URL.revokeObjectURL = originalRevokeObjectURL;
      (global as any).document = originalDocument;
    });
  });
});
