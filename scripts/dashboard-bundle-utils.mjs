import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "fs";
import path from "path";

/**
 * cpSync copies pnpm symlinks as absolute paths back to the standalone build dir.
 * Rewrite every symlink in the published dashboard bundle to a relative path
 * inside bundleRoot so npm installs work on any machine.
 */
export function relativizeSymlinks(bundleRoot, sourceRoot) {
  const bundleRootResolved = path.resolve(bundleRoot);
  const sourceRootResolved = path.resolve(sourceRoot);

  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const st = lstatSync(full);

      if (st.isSymbolicLink()) {
        const rawTarget = readlinkSync(full);
        let resolvedTarget;

        if (path.isAbsolute(rawTarget)) {
          if (rawTarget.startsWith(sourceRootResolved)) {
            resolvedTarget = path.join(
              bundleRootResolved,
              path.relative(sourceRootResolved, rawTarget)
            );
          } else if (rawTarget.startsWith(bundleRootResolved)) {
            resolvedTarget = rawTarget;
          } else {
            throw new Error(
              `Symlink points outside dashboard bundle: ${full} -> ${rawTarget}`
            );
          }
        } else {
          resolvedTarget = path.resolve(path.dirname(full), rawTarget);
        }

        if (!resolvedTarget.startsWith(bundleRootResolved)) {
          throw new Error(
            `Symlink target escapes dashboard bundle: ${full} -> ${resolvedTarget}`
          );
        }
        if (!existsSync(resolvedTarget)) {
          throw new Error(
            `Symlink target missing in dashboard bundle: ${full} -> ${resolvedTarget}`
          );
        }

        const relativeTarget = path.relative(path.dirname(full), resolvedTarget);
        if (relativeTarget === rawTarget) continue;

        rmSync(full);
        symlinkSync(relativeTarget, full);
        continue;
      }

      if (st.isDirectory()) walk(full);
    }
  }

  walk(bundleRootResolved);
}

/**
 * npm publish drops symlink entries under apps/web/node_modules, so require()
 * walks up to the host project's Next.js. Copy Next + Prisma runtime deps as
 * real files (including styled-jsx, react-dom, etc.).
 */
export function materializeEntryNodeModules(bundleRoot) {
  const entryNm = path.join(bundleRoot, "apps/web/node_modules");
  const pnpmDir = path.join(bundleRoot, "node_modules/.pnpm");
  if (!existsSync(pnpmDir)) return;

  rmSync(entryNm, { recursive: true, force: true });
  mkdirSync(entryNm, { recursive: true });

  const pnpmPrefixes = ["next@", "@prisma+client@"];
  for (const dirEntry of readdirSync(pnpmDir)) {
    if (!pnpmPrefixes.some((prefix) => dirEntry.startsWith(prefix))) continue;

    const nm = path.join(pnpmDir, dirEntry, "node_modules");
    if (!existsSync(nm)) continue;

    for (const pkg of readdirSync(nm)) {
      const src = path.join(nm, pkg);
      const dest = path.join(entryNm, pkg);
      rmSync(dest, { recursive: true, force: true });
      cpSync(src, dest, { recursive: true, dereference: true });
    }
  }
}

export function verifyDashboardBundle(bundleRoot) {
  const bundleRootResolved = path.resolve(bundleRoot);
  const serverCwd = path.join(bundleRootResolved, "apps/web");
  const nextEntry = path.join(serverCwd, "node_modules/next");

  if (!existsSync(nextEntry)) {
    throw new Error(`Bundled dashboard is missing next at ${nextEntry}`);
  }

  if (lstatSync(nextEntry).isSymbolicLink()) {
    throw new Error(
      `Bundled next must be materialized for npm publish: ${nextEntry}`
    );
  }

  const pkgJson = path.join(nextEntry, "package.json");
  if (!existsSync(pkgJson)) {
    throw new Error(`Bundled next package.json missing: ${pkgJson}`);
  }

  const prismaClient = path.join(serverCwd, "node_modules/@prisma/client");
  const prismaGenerated = path.join(serverCwd, "node_modules/.prisma/client");
  if (!existsSync(prismaClient)) {
    throw new Error(`Bundled @prisma/client missing: ${prismaClient}`);
  }
  if (!existsSync(prismaGenerated)) {
    throw new Error(`Bundled Prisma generated client missing: ${prismaGenerated}`);
  }

  const styledJsx = path.join(serverCwd, "node_modules/styled-jsx/package.json");
  if (!existsSync(styledJsx)) {
    throw new Error(`Bundled styled-jsx missing (Next.js runtime dep): ${styledJsx}`);
  }
}
