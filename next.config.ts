import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ─── Turbopack workspace root ──────────────────────────────────────────
  // Per `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/turbopack.md`
  // (line 99–124): Turbopack autodetects the workspace root by walking
  // UP from the project looking for a lockfile (`package-lock.json`,
  // `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`).  If it finds one in a
  // parent directory (we previously had a stray `~/package-lock.json`),
  // the root snaps to that parent — and Turbopack then resolves AND
  // watches every file under that root.  When the root accidentally
  // becomes `/Users/<you>/`, the file watcher and Tailwind source
  // detection scan the entire home tree, which is what blew the dev
  // server up to 80 GB of RAM.
  //
  // Hardcoded absolute path here so the root is locked-in regardless of
  // (a) whether `__dirname` is defined in this config's runtime
  // (CJS-yes / pure-ESM-no), (b) where the dev server was launched
  // from, or (c) what stray lockfiles happen to exist outside the repo.
  turbopack: {
    root: "/Users/emmanuel/report-builder",
  },

  // ─── Barrel-import optimization ────────────────────────────────────────
  // Per `optimizePackageImports.md` lines 22–49, Next.js already
  // optimises `lucide-react` and `recharts` out of the box — but only
  // the packages explicitly in that allowlist.  `@base-ui/react` is
  // NOT on the list and exposes many surface modules; adding it here
  // tells Turbopack/Next to only pull in the modules we actually
  // reference instead of walking the whole package's module graph
  // during the dev compile (a per-build cost that compounds with HMR).
  experimental: {
    optimizePackageImports: ["@base-ui/react"],
  },
};

export default nextConfig;
