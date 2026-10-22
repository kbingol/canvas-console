import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import App from "./App";
import { ConsoleProvider } from "./lib/console-context";
import { consoleTheme } from "./theme";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FluentProvider theme={consoleTheme}>
      <ConsoleProvider>
        <App />
      </ConsoleProvider>
    </FluentProvider>
  </StrictMode>,
);
