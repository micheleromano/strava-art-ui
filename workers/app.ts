import { createRequestHandler } from "react-router";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

const SECURITY_HEADERS = {
  // Stops other sites framing the app to trick people into clicking Connect or Disconnect.
  "Content-Security-Policy": "frame-ancestors 'none'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
};

export default {
  async fetch(request) {
    const response = await requestHandler(request);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(name, value);
    }
    return response;
  },
} satisfies ExportedHandler<Env>;
