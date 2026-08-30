import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./platform/auth/AuthProvider";
import { SecurityWall } from "./platform/auth/SecurityWall";
import { WorkspaceProvider } from "./platform/workspace/WorkspaceProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <SecurityWall>
        <WorkspaceProvider>
          <App />
        </WorkspaceProvider>
      </SecurityWall>
    </AuthProvider>
  </React.StrictMode>,
);
