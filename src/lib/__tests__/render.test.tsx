import { describe, it } from "vitest";
import React from "react";
import { WelcomeHero } from "../../components/regex-tool/WelcomeHero";
import { DataGrid } from "../../components/regex-tool/DataGrid";
import { PatternPanel } from "../../components/regex-tool/PatternPanel";
import { renderToString } from "react-dom/server";

describe("Component SSR render", () => {
  it("renders WelcomeHero", () => {
    const html = renderToString(
      React.createElement(WelcomeHero, {
        onImportFile: () => {},
        onOpenPaste: () => {},
        onStartBlank: () => {},
      })
    );
    console.log("WelcomeHero length:", html.length);
  });

  it("renders DataGrid", () => {
    const html = renderToString(
      React.createElement(DataGrid, {
        rows: ["test 1", "test 2"],
        columns: [
          {
            id: "col1",
            name: "Col 1",
            user: ["1", "2"],
            derived: ["1", "2"],
            failures: [],
          },
        ],
        activeId: "col1",
        onSelect: () => {},
        onChangeCell: () => {},
        onAddColumn: () => {},
        onRemoveColumn: () => {},
        onRenameColumn: () => {},
      })
    );
    console.log("DataGrid length:", html.length);
  });

  it("renders PatternPanel", () => {
    const html = renderToString(
      React.createElement(PatternPanel, {
        column: {
          id: "col1",
          name: "Col 1",
          user: ["1", "2"],
          derived: ["1", "2"],
          failures: [],
          rule: { source: "\\d+", target: "" },
        },
        rowCount: 2,
        rows: ["test 1", "test 2"],
      })
    );
    console.log("PatternPanel length:", html.length);
  });
});

