import { isDefined, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { setTimeout } from "timers/promises"

/**
 * The keys to be locked
 */
export interface AcquireLockStepInput {
  key: string | string[]
  timeout?: number // in seconds. Defaults to 0
  retryInterval?: number // in seconds. Defaults to 0.3
  ttl?: number // in seconds
  ownerId?: string
  provider?: string
}

export const acquireLockStepId = "acquire-lock-step"
/**
 * This step acquires a lock for a given key.
 *
 * @example
 * const data = acquireLockStep({
 *   "key": "my-lock-key",
 *   "ttl": 60
 * })
 */
export const acquireLockStep = createStep(
  acquireLockStepId,
  async (data: AcquireLockStepInput, { container }) => {
    const keys = Array.isArray(data.key)
      ? data.key
      : isDefined(data.key)
      ? [data.key]
      : []

    if (!keys.length) {
      return new StepResponse(void 0)
    }

    const locking = container.resolve(Modules.LOCKING)

    const retryInterval = data.retryInterval ?? 0.3
    const tryUntil = Date.now() + (data.timeout ?? 0) * 1000

    while (true) {
      try {
        await locking.acquire(data.key, {
          expire: data.ttl,
          ownerId: data.ownerId,
          provider: data.provider,
        })
        break
      } catch (e) {
        if (Date.now() >= tryUntil) {
          throw e
        }
      }

      await setTimeout(retryInterval * 1000)
    }

    return new StepResponse(void 0, {
      keys,
      ownerId: data.ownerId,
      provider: data.provider,
    })
  },
  async (data, { container }) => {
    if (!data?.keys?.length) {
      return
    }

    const locking = container.resolve(Modules.LOCKING)

    await locking.release(data.keys, {
      ownerId: data.ownerId,
      provider: data.provider,
    })

    return new StepResponse()
  }
)
