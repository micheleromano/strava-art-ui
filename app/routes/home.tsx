import { Alert, Button, buttonVariants, Card } from "@heroui/react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Form, Link } from "react-router";

import { clearActivities } from "~/lib/activity-store";
import { sampleActivities } from "~/lib/sample.server";
import { sessionFrom } from "~/lib/session.server";
import i18n from "~/i18n";

import type { Route } from "./+types/home";

const ERRORS = ["denied", "scope", "failed", "expired", "revoke"] as const;

// Card titles are h3 by default; these sit directly under the page's h1, so they're h2.
const asHeading2 = (props: ComponentProps<"h2">) => <h2 {...props} />;
type HomeError = (typeof ERRORS)[number];

export function meta() {
  return [
    { title: i18n.t("app.name") },
    { name: "description", content: i18n.t("app.description") },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await sessionFrom(request);
  const error = new URL(request.url).searchParams.get("error");
  return {
    connected: session.has("tokens"),
    hasSample: sampleActivities.length > 0,
    error: ERRORS.find((known) => known === error) ?? null,
  };
}

// Activities only stay in this browser while Strava is connected, e.g. right after disconnecting.
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  const data = await serverLoader();
  if (!data.connected) await clearActivities();
  return data;
}
clientLoader.hydrate = true as const;

export default function Home({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const { connected, hasSample, error } = loaderData;

  return (
    <main className="container mx-auto flex max-w-4xl flex-col gap-8 p-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{t("app.name")}</h1>
        <p className="text-muted">{t("app.description")}</p>
      </header>

      {error && <ErrorAlert error={error} />}

      <div className="grid gap-4 sm:grid-cols-2">
        {connected ? (
          <Card>
            <Card.Header>
              <Card.Title render={asHeading2}>
                {t("home.connected.title")}
              </Card.Title>
              <Card.Description>{t("home.connected.body")}</Card.Description>
            </Card.Header>
            <Card.Footer className="flex flex-wrap gap-2">
              <Link to="/studio" className={buttonVariants()}>
                {t("home.connected.action")}
              </Link>
              <Form method="post" action="/disconnect">
                <Button type="submit" variant="secondary">
                  {t("studio.disconnect")}
                </Button>
              </Form>
            </Card.Footer>
          </Card>
        ) : (
          <Card>
            <Card.Header>
              <Card.Title render={asHeading2}>
                {t("home.connect.title")}
              </Card.Title>
              <Card.Description>{t("home.connect.body")}</Card.Description>
            </Card.Header>
            <Card.Content>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>{t("home.connect.permission")}</li>
                <li>{t("home.connect.storage")}</li>
                <li>{t("home.connect.cookie")}</li>
                <li>{t("home.connect.disconnect")}</li>
              </ul>
            </Card.Content>
            <Card.Footer>
              {/* A full page post, so the browser follows the redirect to Strava's sign-in. */}
              <Form method="post" action="/auth/strava" reloadDocument>
                <Button type="submit">{t("home.connect.action")}</Button>
              </Form>
            </Card.Footer>
          </Card>
        )}

        {hasSample && (
          <Card>
            <Card.Header>
              <Card.Title render={asHeading2}>
                {t("home.sample.title")}
              </Card.Title>
              <Card.Description>{t("home.sample.body")}</Card.Description>
            </Card.Header>
            <Card.Footer>
              <Link
                to="/studio?source=sample"
                className={buttonVariants({ variant: "secondary" })}
              >
                {t("home.sample.action")}
              </Link>
            </Card.Footer>
          </Card>
        )}
      </div>
    </main>
  );
}

function ErrorAlert({ error }: { error: HomeError }) {
  const { t } = useTranslation();
  return (
    <Alert status={error === "denied" ? "default" : "warning"}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{t(`home.errors.${error}`)}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
