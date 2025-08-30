import { exec } from "child_process"
import fs from "fs"
import inquirer from "inquirer"
import { customAlphabet } from "nanoid"
import path from "path"
import { isAbortError } from "./create-abort-controller.js"
import execute from "./execute.js"
import { displayFactBox, FactBoxOptions } from "./facts.js"
import logMessage from "./log-message.js"
import ProcessManager from "./process-manager.js"
import { updatePackageVersions } from "./update-package-versions.js"

const NEXTJS_REPO = "https://github.com/medusajs/nextjs-starter-medusa"
const NEXTJS_BRANCH = "main"

export async function askForNextjsStarter(): Promise<boolean> {
  const { installNextjs } = await inquirer.prompt([
    {
      type: "confirm",
      name: "installNextjs",
      message: `Would you like to install the Next.js Starter Storefront? You can also install it later.`,
      default: false,
    },
  ])

  return installNextjs
}

type InstallOptions = {
  directoryName: string
  abortController?: AbortController
  factBoxOptions: FactBoxOptions
  verbose?: boolean
  processManager: ProcessManager
  version?: string
}

export async function installNextjsStarter({
  directoryName,
  abortController,
  factBoxOptions,
  verbose = false,
  processManager,
  version,
}: InstallOptions): Promise<string> {
  factBoxOptions.interval = displayFactBox({
    ...factBoxOptions,
    title: "Installing Next.js Starter Storefront...",
  })

  let nextjsDirectory = `${directoryName}-storefront`

  if (
    fs.existsSync(nextjsDirectory) &&
    fs.lstatSync(nextjsDirectory).isDirectory()
  ) {
    // append a random number to the directory name
    nextjsDirectory += `-${customAlphabet(
      // npm throws an error if the directory name has an uppercase letter
      "123456789abcdefghijklmnopqrstuvwxyz",
      4
    )()}`
  }

  try {
    await execute(
      [
        `git clone ${NEXTJS_REPO} -b ${NEXTJS_BRANCH} ${nextjsDirectory} --depth 1`,
        {
          signal: abortController?.signal,
          env: process.env,
        },
      ],
      { verbose }
    )

    if (version) {
      const packageJsonPath = path.join(nextjsDirectory, "package.json")
      updatePackageVersions(packageJsonPath, version, { applyChanges: true })
    }

    const execOptions = {
      signal: abortController?.signal,
      cwd: nextjsDirectory,
    }
    await processManager.runProcess({
      process: async () => {
        try {
          await execute([`yarn`, execOptions], { verbose })
        } catch (e) {
          // yarn isn't available
          // use npm
          await execute([`npm install`, execOptions], {
            verbose,
          })
        }
      },
      ignoreERESOLVE: true,
    })
  } catch (e) {
    if (isAbortError(e)) {
      process.exit()
    }

    logMessage({
      message: `An error occurred while installing Next.js Starter Storefront: ${e}`,
      type: "error",
    })
  }

  fs.rmSync(path.join(nextjsDirectory, ".git"), {
    recursive: true,
    force: true,
  })

  fs.renameSync(
    path.join(nextjsDirectory, ".env.template"),
    path.join(nextjsDirectory, ".env.local")
  )

  displayFactBox({
    ...factBoxOptions,
    message: `Installed Next.js Starter Storefront successfully in the ${nextjsDirectory} directory.`,
  })

  return nextjsDirectory
}

type StartOptions = {
  directory: string
  abortController?: AbortController
  verbose?: boolean
}

export function startNextjsStarter({
  directory,
  abortController,
  verbose = false,
}: StartOptions) {
  const childProcess = exec(`npm run dev`, {
    cwd: directory,
    signal: abortController?.signal,
  })

  if (verbose) {
    childProcess.stdout?.pipe(process.stdout)
    childProcess.stderr?.pipe(process.stderr)
  }
}
