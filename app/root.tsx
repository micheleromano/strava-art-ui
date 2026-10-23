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
  const { t } = useTranslation();
  return (
    <>
      <Outlet />
      {/*
        Strava's official "Powered by Strava" logo, unmodified. Its brand guidelines require it
        to be apart from, and no more prominent than, the app's own name, so it's small and
        at the foot of every page. Black on light backgrounds, white on dark.
      */}
      <footer className="container mx-auto flex justify-center p-4 pb-8">
        <img
          src="/strava/api_logo_pwrdBy_strava_horiz_black.svg"
          alt={t("app.poweredBy")}
          width={148}
          height={15}
          className="dark:hidden"
        />
        <img
          src="/strava/api_logo_pwrdBy_strava_horiz_white.svg"
          alt={t("app.poweredBy")}
          width={148}
          height={15}
          className="hidden dark:block"
        />
      </footer>
    </>
  );
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
