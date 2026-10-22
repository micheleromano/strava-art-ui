import { buttonVariants } from "@heroui/react";
import { useTranslation } from "react-i18next";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import i18n from "./i18n";
import "./app.css";

// Runs before the page paints, so dark mode follows the system setting without a flash of the light theme.
const themeScript = `(() => {
  const query = matchMedia("(prefers-color-scheme: dark)");
  const apply = () => document.documentElement.classList.toggle("dark", query.matches);
  apply();
  query.addEventListener("change", apply);
})();`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={i18n.language} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Meta />
        <Links />
      </head>
      <body className="min-h-dvh bg-background text-foreground">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const stack =
    import.meta.env.DEV && error instanceof Error ? error.stack : undefined;

  return (
    <main className="container mx-auto flex flex-col items-start gap-4 p-4 pt-16">
      <h1 className="text-2xl font-semibold">
        {notFound ? t("errors.notFound") : t("errors.unexpected")}
      </h1>
      <Link to="/" className={buttonVariants({ variant: "secondary" })}>
        {t("errors.home")}
      </Link>
      {stack && (
        <pre className="w-full overflow-x-auto p-4 text-sm">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
