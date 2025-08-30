import execute from "./execute.js"
import ProcessManager from "./process-manager.js"

export default class PackageManager {
  protected packageManager?: "npm" | "yarn"
  protected processManager: ProcessManager
  protected verbose

  constructor(processManager: ProcessManager, verbose = false) {
    this.processManager = processManager
    this.verbose = verbose
  }

  async setPackageManager(execOptions: Record<string, unknown>): Promise<void> {
    if (this.packageManager) {
      return
    }

    // check whether yarn is available
    await this.processManager.runProcess({
      process: async () => {
        try {
          await execute([`yarn -v`, execOptions], { verbose: this.verbose })
          // yarn is available
          this.packageManager = "yarn"
        } catch (e) {
          // yarn isn't available
          // use npm
          this.packageManager = "npm"
        }
      },
      ignoreERESOLVE: true,
    })
  }

  async installDependencies(
    execOptions: Record<string, unknown>,
  ) {
    if (!this.packageManager) {
      await this.setPackageManager(execOptions)
    }

    const command = this.packageManager === "yarn" ? 
      `yarn` : `npm install`

    await this.processManager.runProcess({
      process: async () => {
        await execute([command, execOptions], {
          verbose: this.verbose
        })
      },
      ignoreERESOLVE: true,
    })
  }

  async runCommand(
    command: string,
    execOptions: Record<string, unknown>,
  ) {
    if (!this.packageManager) {
      await this.setPackageManager(execOptions)
    }

    const commandStr = this.getCommandStr(command)

    await this.processManager.runProcess({
        process: async () => {
          await execute([commandStr, execOptions], {
            verbose: this.verbose
          })
        },
        ignoreERESOLVE: true,
      })
  }

  getCommandStr(
    command: string,
  ): string {
    if (!this.packageManager) {
      throw new Error("Package manager not set")
    }

    return this.packageManager === "yarn"
      ? `yarn ${command}`
      : `npm run ${command}`
  }
}