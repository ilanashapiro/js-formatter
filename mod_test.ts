import { assertEquals } from "https://deno.land/std@0.113.0/testing/asserts.ts";
import { createFromBuffer, createStreaming, Formatter, GlobalConfiguration } from "./mod.ts";

Deno.test("it should create streaming", async () => {
  const formatters = await createStreaming(
    fetch("https://plugins.dprint.dev/json-0.19.1.wasm"),
  );
  runGeneralJsonFormatterTests(formatters);
});

Deno.test("it should create from buffer", async () => {
  const buffer = await fetch("https://plugins.dprint.dev/json-0.19.1.wasm")
    .then((r) => r.arrayBuffer());
  const formatters = createFromBuffer(buffer);
  runGeneralJsonFormatterTests(formatters);
});

function runGeneralJsonFormatterTests(formatters: Formatter[]) {
  const globalConfig: GlobalConfiguration = {
    indentWidth: 4,
    lineWidth: 30,
  };
  formatters.forEach(formatter => {
    formatter.setConfig(globalConfig, {
      preferSingleLine: true,
    });
    assertEquals(formatter.getConfigDiagnostics().length, 0);
    assertEquals(formatter.getLicenseText().includes("MIT"), true);
    assertEquals(formatter.getPluginInfo(), {
      name: "dprint-plugin-json",
      version: "0.19.1",
      configKey: "json",
      helpUrl: "https://dprint.dev/plugins/json",
      configSchemaUrl: "https://plugins.dprint.dev/dprint/dprint-plugin-json/0.19.1/schema.json",
      updateUrl: "https://plugins.dprint.dev/dprint/dprint-plugin-json/latest.json",
      fileExtensions: [ "json", "jsonc" ],
      fileNames: []
    });
    assertEquals(formatter.getResolvedConfig(), {
      lineWidth: 30,
      useTabs: false,
      indentWidth: 4,
      newLineKind: "lf",
      "commentLine.forceSpaceAfterSlashes": true,
      ignoreNodeCommentText: "dprint-ignore",
      "array.preferSingleLine": true,
      "object.preferSingleLine": true,
      trailingCommas: "jsonc",
      jsonTrailingCommaFiles: []
    });
    assertEquals(
      formatter.formatText("file.json", "{\ntest: [ \n1, \n2] }"),
      `{ "test": [1, 2] }\n`,
    );
    assertEquals(
      formatter.formatText("file.json", "{\ntest: [ \n1, \n2] }", {
        "object.preferSingleLine": false,
      }),
      `{\n    "test": [1, 2]\n}\n`,
    );
    // assertEquals(
    //   formatter.formatText("file.md", "Testing:\r\n<!-- dprint-ignore -->\r\n```json\r\ntesting\r\n```\r\n"),
    //   "Testing:\n\n<!-- dprint-ignore -->\n```json\ntesting\n```\n",
    // );
  });
}
