import type { AuthConfig } from "convex/server";

const clerkDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;
if (!clerkDomain) {
  throw new Error(
    "CLERK_JWT_ISSUER_DOMAIN is not configured in Convex environment variables.",
  );
}
if (!/^https:\/\/.+\.clerk\.accounts\.dev$/.test(clerkDomain)) {
  throw new Error(
    "CLERK_JWT_ISSUER_DOMAIN has an invalid format. Expected a URL like 'https://<subdomain>.clerk.accounts.dev'.",
  );
}

export default {
  providers: [
    {
      domain: clerkDomain,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
