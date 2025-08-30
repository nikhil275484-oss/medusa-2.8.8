import {
  DistributedTransactionType,
  IDistributedSchedulerStorage,
  IDistributedTransactionStorage,
  SchedulerOptions,
  SkipCancelledExecutionError,
  SkipExecutionError,
  TransactionCheckpoint,
  TransactionContext,
  TransactionFlow,
  TransactionOptions,
  TransactionStep,
  TransactionStepError,
} from "@medusajs/framework/orchestration"
import {
  InferEntityType,
  Logger,
  ModulesSdkTypes,
} from "@medusajs/framework/types"
import {
  MedusaError,
  TransactionState,
  TransactionStepState,
  isPresent,
} from "@medusajs/framework/utils"
import { raw } from "@mikro-orm/core"
import { WorkflowOrchestratorService } from "@services"
import { type CronExpression, parseExpression } from "cron-parser"
import { WorkflowExecution } from "../models/workflow-execution"

function parseNextExecution(
  optionsOrExpression: SchedulerOptions | CronExpression | string | number
) {
  if (typeof optionsOrExpression === "object") {
    if ("cron" in optionsOrExpression) {
      const expression = parseExpression(optionsOrExpression.cron)
      return expression.next().getTime() - Date.now()
    }

    if ("interval" in optionsOrExpression) {
      return optionsOrExpression.interval
    }

    return optionsOrExpression.next().getTime() - Date.now()
  }

  const result = parseInt(`${optionsOrExpression}`)

  if (isNaN(result)) {
    const expression = parseExpression(`${optionsOrExpression}`)
    return expression.next().getTime() - Date.now()
  }

  return result
}

export class InMemoryDistributedTransactionStorage
  implements IDistributedTransactionStorage, IDistributedSchedulerStorage
{
  private workflowExecutionService_: ModulesSdkTypes.IMedusaInternalService<any>
  private logger_: Logger
  private workflowOrchestratorService_: WorkflowOrchestratorService

  private storage: Map<string, Omit<TransactionCheckpoint, "context">> =
    new Map()
  private scheduled: Map<
    string,
    {
      timer: NodeJS.Timeout
      expression: CronExpression | number
      numberOfExecutions: number
      config: SchedulerOptions
    }
  > = new Map()
  private retries: Map<string, unknown> = new Map()
  private timeouts: Map<string, unknown> = new Map()

  private clearTimeout_: NodeJS.Timeout

  constructor({
    workflowExecutionService,
    logger,
  }: {
    workflowExecutionService: ModulesSdkTypes.IMedusaInternalService<any>
    logger: Logger
  }) {
    this.workflowExecutionService_ = workflowExecutionService
    this.logger_ = logger
  }

  async onApplicationStart() {
    this.clearTimeout_ = setInterval(async () => {
      try {
        await this.clearExpiredExecutions()
      } catch {}
    }, 1000 * 60 * 60)
  }

  async onApplicationShutdown() {
    clearInterval(this.clearTimeout_)
  }

  setWorkflowOrchestratorService(workflowOrchestratorService) {
    this.workflowOrchestratorService_ = workflowOrchestratorService
  }

  private async saveToDb(data: TransactionCheckpoint, retentionTime?: number) {
    await this.workflowExecutionService_.upsert([
      {
        workflow_id: data.flow.modelId,
        transaction_id: data.flow.transactionId,
        run_id: data.flow.runId,
        execution: data.flow,
        context: {
          data: data.context,
          errors: data.errors,
        },
        state: data.flow.state,
        retention_time: retentionTime,
      },
    ])
  }

  private async deleteFromDb(data: TransactionCheckpoint) {
    await this.workflowExecutionService_.delete([
      {
        workflow_id: data.flow.modelId,
        transaction_id: data.flow.transactionId,
        run_id: data.flow.runId,
      },
    ])
  }

  async get(
    key: string,
    options?: TransactionOptions & {
      isCancelling?: boolean
    }
  ): Promise<TransactionCheckpoint | undefined> {
    const [_, workflowId, transactionId] = key.split(":")
    const trx: InferEntityType<typeof WorkflowExecution> | undefined =
      await this.workflowExecutionService_
        .list(
          {
            workflow_id: workflowId,
            transaction_id: transactionId,
          },
          {
            select: ["execution", "context"],
            order: {
              id: "desc",
            },
            take: 1,
          }
        )
        .then((trx) => trx[0])
        .catch(() => undefined)

    if (trx) {
      const { flow, errors } = this.storage.get(key) ?? {}
      const { idempotent } = options ?? {}
      const execution = trx.execution as TransactionFlow

      if (!idempotent) {
        const isFailedOrReverted = [
          TransactionState.REVERTED,
          TransactionState.FAILED,
        ].includes(execution.state)

        const isDone = execution.state === TransactionState.DONE

        const isCancellingAndFailedOrReverted =
          options?.isCancelling && isFailedOrReverted

        const isNotCancellingAndDoneOrFailedOrReverted =
          !options?.isCancelling && (isDone || isFailedOrReverted)

        if (
          isCancellingAndFailedOrReverted ||
          isNotCancellingAndDoneOrFailedOrReverted
        ) {
          return
        }
      }

      return {
        flow: flow ?? (trx.execution as TransactionFlow),
        context: trx.context?.data as TransactionContext,
        errors: errors ?? (trx.context?.errors as TransactionStepError[]),
      }
    }

    return
  }

  async save(
    key: string,
    data: TransactionCheckpoint,
    ttl?: number,
    options?: TransactionOptions
  ): Promise<void> {
    /**
     * Store the retention time only if the transaction is done, failed or reverted.
     * From that moment, this tuple can be later on archived or deleted after the retention time.
     */
    const hasFinished = [
      TransactionState.DONE,
      TransactionState.FAILED,
      TransactionState.REVERTED,
    ].includes(data.flow.state)

    const { retentionTime, idempotent } = options ?? {}

    await this.#preventRaceConditionExecutionIfNecessary({
      data,
      key,
      options,
    })

    // Only store retention time if it's provided
    if (retentionTime) {
      Object.assign(data, {
        retention_time: retentionTime,
      })
    }

    // Store in memory
    const isNotStarted = data.flow.state === TransactionState.NOT_STARTED
    const isManualTransactionId = !data.flow.transactionId.startsWith("auto-")

    if (isNotStarted && isManualTransactionId) {
      const storedData = this.storage.get(key)
      if (storedData) {
        throw new MedusaError(
          MedusaError.Types.INVALID_ARGUMENT,
          "Transaction already started for transactionId: " +
            data.flow.transactionId
        )
      }
    }

    const { flow, errors } = data
    this.storage.set(key, {
      flow,
      errors,
    })

    // Optimize DB operations - only perform when necessary
    if (hasFinished) {
      if (!retentionTime && !idempotent) {
        await this.deleteFromDb(data)
      } else {
        await this.saveToDb(data, retentionTime)
      }

      this.storage.delete(key)
    } else {
      await this.saveToDb(data, retentionTime)
    }
  }

  async #preventRaceConditionExecutionIfNecessary({
    data,
    key,
    options,
  }: {
    data: TransactionCheckpoint
    key: string
    options?: TransactionOptions
  }) {
    const isInitialCheckpoint = [TransactionState.NOT_STARTED].includes(
      data.flow.state
    )

    /**
     * In case many execution can succeed simultaneously, we need to ensure that the latest
     * execution does continue if a previous execution is considered finished
     */
    const currentFlow = data.flow

    const rawData = this.storage.get(key)
    let data_ = {} as TransactionCheckpoint
    if (rawData) {
      data_ = rawData as TransactionCheckpoint
    } else {
      const getOptions = {
        ...options,
        isCancelling: !!data.flow.cancelledAt,
      } as Parameters<typeof this.get>[1]

      data_ =
        (await this.get(key, getOptions)) ??
        ({ flow: {} } as TransactionCheckpoint)
    }

    const { flow: latestUpdatedFlow } = data_

    if (!isInitialCheckpoint && !isPresent(latestUpdatedFlow)) {
      /**
       * the initial checkpoint expect no other checkpoint to have been stored.
       * In case it is not the initial one and another checkpoint is trying to
       * find if a concurrent execution has finished, we skip the execution.
       * The already finished execution would have deleted the checkpoint already.
       */
      throw new SkipExecutionError("Already finished by another execution")
    }

    // First ensure that the latest execution was not cancelled, otherwise we skip the execution
    const latestTransactionCancelledAt = latestUpdatedFlow.cancelledAt
    const currentTransactionCancelledAt = currentFlow.cancelledAt

    if (
      !!latestTransactionCancelledAt &&
      currentTransactionCancelledAt == null
    ) {
      throw new SkipCancelledExecutionError(
        "Workflow execution has been cancelled during the execution"
      )
    }

    const currentFlowSteps = Object.values(currentFlow.steps || {})
    const latestUpdatedFlowSteps = latestUpdatedFlow.steps
      ? Object.values(
          latestUpdatedFlow.steps as Record<string, TransactionStep>
        )
      : []

    // Predefined states for quick lookup
    const invokingStates = [
      TransactionStepState.INVOKING,
      TransactionStepState.NOT_STARTED,
    ]

    const compensatingStates = [
      TransactionStepState.COMPENSATING,
      TransactionStepState.NOT_STARTED,
    ]

    const isInvokingState = (step: TransactionStep) =>
      invokingStates.includes(step.invoke?.state)

    const isCompensatingState = (step: TransactionStep) =>
      compensatingStates.includes(step.compensate?.state)

    const currentFlowLastInvokingStepIndex =
      currentFlowSteps.findIndex(isInvokingState)

    const latestUpdatedFlowLastInvokingStepIndex = !latestUpdatedFlow.steps
      ? 1 // There is no other execution, so the current execution is the latest
      : latestUpdatedFlowSteps.findIndex(isInvokingState)

    const reversedCurrentFlowSteps = [...currentFlowSteps].reverse()
    const currentFlowLastCompensatingStepIndex =
      reversedCurrentFlowSteps.findIndex(isCompensatingState)

    const reversedLatestUpdatedFlowSteps = [...latestUpdatedFlowSteps].reverse()
    const latestUpdatedFlowLastCompensatingStepIndex = !latestUpdatedFlow.steps
      ? -1 // There is no other execution, so the current execution is the latest
      : reversedLatestUpdatedFlowSteps.findIndex(isCompensatingState)

    const isLatestExecutionFinishedIndex = -1
    const invokeShouldBeSkipped =
      (latestUpdatedFlowLastInvokingStepIndex ===
        isLatestExecutionFinishedIndex ||
        currentFlowLastInvokingStepIndex <
          latestUpdatedFlowLastInvokingStepIndex) &&
      currentFlowLastInvokingStepIndex !== isLatestExecutionFinishedIndex

    const compensateShouldBeSkipped =
      currentFlowLastCompensatingStepIndex <
        latestUpdatedFlowLastCompensatingStepIndex &&
      currentFlowLastCompensatingStepIndex !== isLatestExecutionFinishedIndex &&
      latestUpdatedFlowLastCompensatingStepIndex !==
        isLatestExecutionFinishedIndex

    const isCompensatingMismatch =
      latestUpdatedFlow.state === TransactionState.COMPENSATING &&
      ![TransactionState.REVERTED, TransactionState.FAILED].includes(
        currentFlow.state
      ) &&
      currentFlow.state !== latestUpdatedFlow.state

    const isRevertedMismatch =
      latestUpdatedFlow.state === TransactionState.REVERTED &&
      currentFlow.state !== TransactionState.REVERTED

    const isFailedMismatch =
      latestUpdatedFlow.state === TransactionState.FAILED &&
      currentFlow.state !== TransactionState.FAILED

    if (
      (data.flow.state !== TransactionState.COMPENSATING &&
        invokeShouldBeSkipped) ||
      (data.flow.state === TransactionState.COMPENSATING &&
        compensateShouldBeSkipped) ||
      isCompensatingMismatch ||
      isRevertedMismatch ||
      isFailedMismatch
    ) {
      throw new SkipExecutionError("Already finished by another execution")
    }
  }

  async scheduleRetry(
    transaction: DistributedTransactionType,
    step: TransactionStep,
    timestamp: number,
    interval: number
  ): Promise<void> {
    const { modelId: workflowId, transactionId } = transaction

    const inter = setTimeout(async () => {
      const context = transaction.getFlow().metadata ?? {}
      await this.workflowOrchestratorService_.run(workflowId, {
        transactionId,
        logOnError: true,
        throwOnError: false,
        context: {
          eventGroupId: context.eventGroupId,
          parentStepIdempotencyKey: context.parentStepIdempotencyKey,
          preventReleaseEvents: context.preventReleaseEvents,
        },
      })
    }, interval * 1e3)

    const key = `${workflowId}:${transactionId}:${step.id}`
    this.retries.set(key, inter)
  }

  async clearRetry(
    transaction: DistributedTransactionType,
    step: TransactionStep
  ): Promise<void> {
    const { modelId: workflowId, transactionId } = transaction

    const key = `${workflowId}:${transactionId}:${step.id}`
    const inter = this.retries.get(key)
    if (inter) {
      clearTimeout(inter as NodeJS.Timeout)
      this.retries.delete(key)
    }
  }

  async scheduleTransactionTimeout(
    transaction: DistributedTransactionType,
    timestamp: number,
    interval: number
  ): Promise<void> {
    const { modelId: workflowId, transactionId } = transaction

    const inter = setTimeout(async () => {
      const context = transaction.getFlow().metadata ?? {}
      await this.workflowOrchestratorService_.run(workflowId, {
        transactionId,
        logOnError: true,
        throwOnError: false,
        context: {
          eventGroupId: context.eventGroupId,
          parentStepIdempotencyKey: context.parentStepIdempotencyKey,
          preventReleaseEvents: context.preventReleaseEvents,
        },
      })
    }, interval * 1e3)

    const key = `${workflowId}:${transactionId}`
    this.timeouts.set(key, inter)
  }

  async clearTransactionTimeout(
    transaction: DistributedTransactionType
  ): Promise<void> {
    const { modelId: workflowId, transactionId } = transaction

    const key = `${workflowId}:${transactionId}`
    const inter = this.timeouts.get(key)
    if (inter) {
      clearTimeout(inter as NodeJS.Timeout)
      this.timeouts.delete(key)
    }
  }

  async scheduleStepTimeout(
    transaction: DistributedTransactionType,
    step: TransactionStep,
    timestamp: number,
    interval: number
  ): Promise<void> {
    const { modelId: workflowId, transactionId } = transaction

    const inter = setTimeout(async () => {
      const context = transaction.getFlow().metadata ?? {}
      await this.workflowOrchestratorService_.run(workflowId, {
        transactionId,
        logOnError: true,
        throwOnError: false,
        context: {
          eventGroupId: context.eventGroupId,
          parentStepIdempotencyKey: context.parentStepIdempotencyKey,
          preventReleaseEvents: context.preventReleaseEvents,
        },
      })
    }, interval * 1e3)

    const key = `${workflowId}:${transactionId}:${step.id}`
    this.timeouts.set(key, inter)
  }

  async clearStepTimeout(
    transaction: DistributedTransactionType,
    step: TransactionStep
  ): Promise<void> {
    const { modelId: workflowId, transactionId } = transaction

    const key = `${workflowId}:${transactionId}:${step.id}`
    const inter = this.timeouts.get(key)
    if (inter) {
      clearTimeout(inter as NodeJS.Timeout)
      this.timeouts.delete(key)
    }
  }

  /* Scheduler storage methods */
  async schedule(
    jobDefinition: string | { jobId: string },
    schedulerOptions: SchedulerOptions
  ): Promise<void> {
    const jobId =
      typeof jobDefinition === "string" ? jobDefinition : jobDefinition.jobId

    // In order to ensure that the schedule configuration is always up to date, we first cancel an existing job, if there was one
    await this.remove(jobId)

    let expression: CronExpression | number
    let nextExecution = parseNextExecution(schedulerOptions)

    if ("cron" in schedulerOptions) {
      // Cache the parsed expression to avoid repeated parsing
      expression = parseExpression(schedulerOptions.cron)
    } else if ("interval" in schedulerOptions) {
      expression = schedulerOptions.interval
    } else {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT,
        "Schedule cron or interval definition is required for scheduled jobs."
      )
    }

    const timer = setTimeout(async () => {
      this.jobHandler(jobId)
    }, nextExecution)

    // Set the timer's unref to prevent it from keeping the process alive
    timer.unref()

    this.scheduled.set(jobId, {
      timer,
      expression,
      numberOfExecutions: 0,
      config: schedulerOptions,
    })
  }

  async remove(jobId: string): Promise<void> {
    const job = this.scheduled.get(jobId)
    if (!job) {
      return
    }

    clearTimeout(job.timer)
    this.scheduled.delete(jobId)
  }

  async removeAll(): Promise<void> {
    for (const [key] of this.scheduled) {
      await this.remove(key)
    }
  }

  async jobHandler(jobId: string) {
    const job = this.scheduled.get(jobId)
    if (!job) {
      return
    }

    if (
      job.config?.numberOfExecutions !== undefined &&
      job.config.numberOfExecutions <= job.numberOfExecutions
    ) {
      this.scheduled.delete(jobId)
      return
    }

    const nextExecution = parseNextExecution(job.expression)

    try {
      await this.workflowOrchestratorService_.run(jobId, {
        logOnError: true,
        throwOnError: false,
      })

      // Only schedule the next job execution after the current one completes successfully
      const timer = setTimeout(async () => {
        setImmediate(() => {
          this.jobHandler(jobId)
        })
      }, nextExecution)

      // Prevent timer from keeping the process alive
      timer.unref()

      this.scheduled.set(jobId, {
        timer,
        expression: job.expression,
        numberOfExecutions: (job.numberOfExecutions ?? 0) + 1,
        config: job.config,
      })
    } catch (e) {
      if (e instanceof MedusaError && e.type === MedusaError.Types.NOT_FOUND) {
        this.logger_?.warn(
          `Tried to execute a scheduled workflow with ID ${jobId} that does not exist, removing it from the scheduler.`
        )

        await this.remove(jobId)
        return
      }

      throw e
    }
  }

  async clearExpiredExecutions(): Promise<void> {
    await this.workflowExecutionService_.delete({
      retention_time: {
        $ne: null,
      },
      updated_at: {
        $lte: raw(
          (alias) =>
            `CURRENT_TIMESTAMP - (INTERVAL '1 second' * retention_time)`
        ),
      },
      state: {
        $in: [
          TransactionState.DONE,
          TransactionState.FAILED,
          TransactionState.REVERTED,
        ],
      },
    })
  }
}
