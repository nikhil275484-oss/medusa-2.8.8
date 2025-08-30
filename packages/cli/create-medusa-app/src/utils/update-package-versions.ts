import { readFileSync, writeFileSync } from "fs"

export function updatePackageVersions(
  packageJsonOrPath: string | Record<string, any>,
  version: string,
  { applyChanges = false }: { applyChanges?: boolean } = {}
) {
  const packageJson =
    typeof packageJsonOrPath === "string"
      ? JSON.parse(readFileSync(packageJsonOrPath, "utf-8"))
      : packageJsonOrPath

  if (packageJson.dependencies) {
    for (const dependency of Object.keys(packageJson.dependencies)) {
      if (dependency.startsWith("@medusajs/")) {
        packageJson.dependencies[dependency] = version
      }
    }
  }
  if (packageJson.devDependencies) {
    for (const dependency of Object.keys(packageJson.devDependencies)) {
      if (dependency.startsWith("@medusajs/")) {
        packageJson.devDependencies[dependency] = version
      }
    }
  }

  if (applyChanges && typeof packageJsonOrPath === "string") {
    writeFileSync(packageJsonOrPath, JSON.stringify(packageJson, null, 2))
  }
}
