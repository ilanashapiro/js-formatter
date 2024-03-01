/** Formats code. */
export interface Formatter {
  /**
   * Sets the configuration.
   * @param globalConfig - Global configuration for use across plugins.
   * @param pluginConfig - Plugin specific configuration.
   */
  setConfig(
    globalConfig: GlobalConfiguration,
    pluginConfig: Record<string, unknown>,
  ): void;
  /**
   * Gets the configuration diagnostics.
   */
  getConfigDiagnostics(): ConfigurationDiagnostic[];
  /**
   * Gets the resolved configuration.
   * @returns An object containing the resolved configuration.
   */
  getResolvedConfig(): Record<string, unknown>;
  /**
   * Gets the plugin info.
   */
  getPluginInfo(): PluginInfo;
  /**
   * Gets the license text of the plugin.
   */
  getLicenseText(): string;
  /**
   * Formats the specified file text.
   * @param filePath - The file path to format.
   * @param fileText - File text to format.
   * @param overrideConfig - Configuration to set for a single format.
   * @returns The formatted text.
   * @throws If there is an error formatting.
   */
  formatText(
    filePath: string,
    fileText: string,
    overrideConfig?: Record<string, unknown>,
  ): string;
}

/** Configuration specified for use across plugins. */
export interface GlobalConfiguration {
  lineWidth?: number;
  indentWidth?: number;
  useTabs?: boolean;
  newLineKind?: "auto" | "lf" | "crlf" | "system";
}

/** A diagnostic indicating a problem with the specified configuration. */
export interface ConfigurationDiagnostic {
  propertyName: string;
  message: string;
}

/** Information about a plugin. */
export interface PluginInfo {
  name: string;
  version: string;
  configKey: string;
  fileExtensions: string[];
  fileNames: string[];
  helpUrl: string;
  configSchemaUrl: string;
}

/**
 * Creates the WebAssembly import object, if necessary.
 */
export function createImportObject(innerPluginExports?: WebAssembly.Exports): WebAssembly.Imports {
  return {
    dprint: {
      "host_clear_bytes": innerPluginExports ? innerPluginExports.host_clear_bytes : (() => {}),
      "host_read_buffer": innerPluginExports ? innerPluginExports.host_read_buffer : (() => {}),
      "host_write_buffer": innerPluginExports ? innerPluginExports.host_write_buffer : (() => {}),
      "host_take_file_path": innerPluginExports ? innerPluginExports.host_take_file_path : (() => {}),
      "host_take_override_config": innerPluginExports ? innerPluginExports.host_take_override_config : (() => {}),
      "host_format": innerPluginExports ? innerPluginExports.host_format : (() => 0), // no change
      "host_get_formatted_text": innerPluginExports ? innerPluginExports.host_get_formatted_text : (() => 0), // zero length
      "host_get_error_text": innerPluginExports ? innerPluginExports.host_get_error_text : (() => 0), // zero length
    },
  };
}

export interface ResponseLike {
  status: number;
  arrayBuffer(): Promise<BufferSource>;
  text(): Promise<string>;
  headers: {
    get(name: string): string | null;
  };
}

/**
 * Creates a formatter from the specified streaming source.
 * @remarks This is the most efficient way to create a formatter.
 * @param response - The streaming source to create the formatter from.
 */
export function createStreaming(
  pluginResponse: Promise<ResponseLike>,
  nestedPluginResponse: Promise<ResponseLike>
): Promise<Formatter> {
  if (typeof WebAssembly.instantiate === "function") {
    return Promise.all([pluginResponse, nestedPluginResponse])
    .then(([resolvedPluginResponse, resolvedNestedPluginResponse]) => [resolvedPluginResponse.arrayBuffer(), resolvedNestedPluginResponse.arrayBuffer()])
    .then(([pluginBuffer, nestedPluginBuffer]) => Promise.all([pluginBuffer, nestedPluginBuffer]))
    .then(([resolvedPluginBuffer, resolvedNestedPluginBuffer]) => Promise.all([resolvedPluginBuffer, WebAssembly.instantiate(resolvedNestedPluginBuffer)]))
    .then(([resolvedPluginBuffer, nestedPluginObj]) => WebAssembly.instantiate(resolvedPluginBuffer, createImportObject(nestedPluginObj.instance.exports)))
    .then((pluginObj) => createFromInstance(pluginObj.instance));
    
    // return pluginResponses
    // .then((resolvedResponse) => resolvedResponse.arrayBuffer())
    // .then((buffer) => WebAssembly.instantiate(buffer, createImportObject(null)))
    // .then((obj) => createFromInstance(obj.instance));
  } else {
    // fallback for node.js
    return Promise.all([pluginResponse, nestedPluginResponse])
    .then(([resolvedPluginResponse, resolvedNestedPluginResponse]) => [getArrayBuffer(resolvedPluginResponse), getArrayBuffer(resolvedNestedPluginResponse)])
    .then(([b1, b2])=>Promise.all([b1,b2]))
      .then(([buffer, nestedBuffer]) => createFromBuffer(buffer, nestedBuffer));
  }

  function getArrayBuffer(response: ResponseLike | Promise<any>) {
    if (isResponse(response)) {
      return response.arrayBuffer();
    } else {
      return response.then((response) => response.arrayBuffer());
    }

    function isResponse(response: unknown): response is ResponseLike {
      return (response as Response).arrayBuffer != null;
    }
  }
}

/**
 * Creates a formatter from the specified wasm module bytes.
 * @param wasmModuleBuffer - The buffer of the wasm module.
 */
export function createFromBuffer(wasmPrimaryModuleBuffer: BufferSource, wasmInnerModuleBuffer: BufferSource): Formatter {
  const wasmPrimaryModule = new WebAssembly.Module(wasmPrimaryModuleBuffer);
  const wasmInnerModule = new WebAssembly.Module(wasmInnerModuleBuffer);
  const wasmInnerInstance = new WebAssembly.Instance(
    wasmInnerModule,
    createImportObject(),
  );
  const wasmPrimaryInstance = new WebAssembly.Instance(
    wasmPrimaryModule,
    createImportObject(wasmInnerInstance.exports),
  );
  return createFromInstance(wasmPrimaryInstance);
}

/**
 * Creates a formatter from the specified wasm instance.
 * @param wasmInstance - The WebAssembly instance.
 */
export function createFromInstance(
  wasmInstance: WebAssembly.Instance,
): Formatter {
    // deno-lint-ignore no-explicit-any
    const wasmExports = wasmInstance.exports as any;
    const {
      // deno-lint-ignore camelcase
      get_plugin_schema_version,
      // deno-lint-ignore camelcase
      set_file_path,
      // deno-lint-ignore camelcase
      set_override_config,
      // deno-lint-ignore camelcase
      get_formatted_text,
      format,
      // deno-lint-ignore camelcase
      get_error_text,
      // deno-lint-ignore camelcase
      get_plugin_info,
      // deno-lint-ignore camelcase
      get_resolved_config,
      // deno-lint-ignore camelcase
      get_config_diagnostics,
      // deno-lint-ignore camelcase
      set_global_config,
      // deno-lint-ignore camelcase
      set_plugin_config,
      // deno-lint-ignore camelcase
      get_license_text,
      // deno-lint-ignore camelcase
      get_wasm_memory_buffer,
      // deno-lint-ignore camelcase
      get_wasm_memory_buffer_size,
      // deno-lint-ignore camelcase
      add_to_shared_bytes_from_buffer,
      // deno-lint-ignore camelcase
      set_buffer_with_shared_bytes,
      // deno-lint-ignore camelcase
      clear_shared_bytes,
      // deno-lint-ignore camelcase
      reset_config,
    } = wasmExports;

    const pluginSchemaVersion = get_plugin_schema_version();
    const expectedPluginSchemaVersion = 3;
    if (
      pluginSchemaVersion !== 2
      && pluginSchemaVersion !== expectedPluginSchemaVersion
    ) {
      throw new Error(
        `Not compatible plugin. `
          + `Expected schema ${expectedPluginSchemaVersion}, `
          + `but plugin had ${pluginSchemaVersion}.`,
      );
    }

    const bufferSize = get_wasm_memory_buffer_size();
    let configSet = false;

    return {
      setConfig(globalConfig, pluginConfig) {
        setConfig(globalConfig, pluginConfig);
      },
      getConfigDiagnostics() {
        setConfigIfNotSet();
        const length = get_config_diagnostics();
        return JSON.parse(receiveString(length));
      },
      getResolvedConfig() {
        setConfigIfNotSet();
        const length = get_resolved_config();
        return JSON.parse(receiveString(length));
      },
      getPluginInfo() {
        const length = get_plugin_info();
        const pluginInfo = JSON.parse(receiveString(length)) as PluginInfo;
        pluginInfo.fileNames = pluginInfo.fileNames ?? [];
        return pluginInfo;
      },
      getLicenseText() {
        const length = get_license_text();
        return receiveString(length);
      },
      formatText(filePath, fileText, overrideConfig) {
        // const filePathParts = filePath.split('.');
        // const extension = filePathParts[filePathParts.length - 1]
        // console.log("HERE", filePath, fileText, overrideConfig, "DONE")
        setConfigIfNotSet();
        if (overrideConfig != null) {
          if (pluginSchemaVersion === 2) {
            throw new Error(
              "Cannot set the override configuration for this old plugin.",
            );
          }
          sendString(JSON.stringify(overrideConfig));
          set_override_config();
        }
        sendString(filePath);
        set_file_path();

        sendString(fileText);
        const responseCode = format();
        console.log(wasmExports.memory)
        switch (responseCode) {
          case 0: // no change
            return fileText;
          case 1: // change
            return receiveString(get_formatted_text());
          case 2: // error
            throw new Error(receiveString(get_error_text()));
          default:
            throw new Error(`Unexpected response code: ${responseCode}`);
        }
      }
    };

    function setConfigIfNotSet() {
      if (!configSet) {
        setConfig({}, {});
      }
    }

    function setConfig(
      globalConfig: GlobalConfiguration,
      pluginConfig: Record<string, unknown>,
    ) {
      if (reset_config != null) {
        reset_config();
      }
      sendString(JSON.stringify(globalConfig));
      set_global_config();
      sendString(JSON.stringify(pluginConfig));
      set_plugin_config();
      configSet = true;
    }

    function sendString(text: string) {
      const encoder = new TextEncoder();
      const encodedText = encoder.encode(text);
      const length = encodedText.length;

      clear_shared_bytes(length);

      let index = 0;
      while (index < length) {
        const writeCount = Math.min(length - index, bufferSize);
        const wasmBuffer = getWasmBuffer(writeCount);
        for (let i = 0; i < writeCount; i++) {
          wasmBuffer[i] = encodedText[index + i];
        }
        add_to_shared_bytes_from_buffer(writeCount);
        index += writeCount;
      }
    }

    function receiveString(length: number) {
      const buffer = new Uint8Array(length);
      let index = 0;
      while (index < length) {
        const readCount = Math.min(length - index, bufferSize);
        set_buffer_with_shared_bytes(index, readCount);
        const wasmBuffer = getWasmBuffer(readCount);
        for (let i = 0; i < readCount; i++) {
          buffer[index + i] = wasmBuffer[i];
        }
        index += readCount;
      }
      const decoder = new TextDecoder();
      return decoder.decode(buffer);
    }

    function getWasmBuffer(length: number) {
      const pointer = get_wasm_memory_buffer();
      return new Uint8Array(
        // deno-lint-ignore no-explicit-any
        (wasmInstance.exports.memory as any).buffer,
        pointer,
        length,
      );
    }
}