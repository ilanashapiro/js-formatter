import {
  createStreaming,
  GlobalConfiguration,
} from "./mod.ts";

const globalConfig: GlobalConfiguration = {
  indentWidth: 2,
  lineWidth: 80,
};
const tsFormatter = await createStreaming(
  // check https://plugins.dprint.dev/ for latest plugin versions
  fetch("https://plugins.dprint.dev/typescript-0.57.0.wasm"),
  fetch("https://plugins.dprint.dev/markdown-0.16.3.wasm")
);

tsFormatter.setConfig(globalConfig, {
  semiColons: "asi",
});

// outputs: "const t = 5\n"
console.log(tsFormatter.formatText("file.ts", "Testing:\r\n<!-- dprint-ignore -->\r\n```json\r\ntesting\r\n```\r\n"));