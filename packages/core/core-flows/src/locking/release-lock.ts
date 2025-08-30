import { isDefined, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

/**
 * The locked keys to be released
 */
export interface ReleaseLockStepInput {
  key: string | string[]
  ownerId?: string
  provider?: string
}

export const releaseLockStepId = "release-lock-step"
/**
 * This step releases a lock for a given key.
 *
 * @example
 * const data = releaseLockStep({
 *   "key": "my-lock-key"
 * })
 */
export const releaseLockStep = createStep(
  releaseLockStepId,
  async (data: ReleaseLockStepInput, { container }) => {
    const keys = Array.isArray(data.key)
      ? data.key
      : isDefined(data.key)
      ? [data.key]
      : []

    if (!keys.length) {
      return new StepResponse(true)
    }

    const locking = container.resolve(Modules.LOCKING)
    const released = await locking.release(keys, {
      ownerId: data.ownerId,
      provider: data.provider,
    })

    return new StepResponse(released)
  }
)
