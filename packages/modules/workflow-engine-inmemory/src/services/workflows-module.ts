import {
  Context,
  DAL,
  FilterableWorkflowExecutionProps,
  FindConfig,
  InferEntityType,
  InternalModuleDeclaration,
  ModulesSdkTypes,
  WorkflowExecutionDTO,
  WorkflowsSdkTypes,
} from "@medusajs/framework/types"
import {
  InjectManager,
  InjectSharedContext,
  isDefined,
  MedusaContext,
  ModulesSdkUtils,
} from "@medusajs/framework/utils"
import type {
  ReturnWorkflow,
  UnwrapWorkflowInputDataType,
} from "@medusajs/framework/workflows-sdk"
import { SqlEntityManager } from "@mikro-orm/postgresql"
import { WorkflowExecution } from "@models"
import { WorkflowOrchestratorService } from "@services"
import { WorkflowOrchestratorCancelOptions } from "@types"

type InjectedDependencies = {
  manager: SqlEntityManager
  baseRepository: DAL.RepositoryService
  workflowExecutionService: ModulesSdkTypes.IMedusaInternalService<any>
  workflowOrchestratorService: WorkflowOrchestratorService
}

export class WorkflowsModuleService<
  TWorkflowExecution extends InferEntityType<
    typeof WorkflowExecution
  > = InferEntityType<typeof WorkflowExecution>
> extends ModulesSdkUtils.MedusaService<{
  WorkflowExecution: { dto: InferEntityType<typeof WorkflowExecution> }
}>({ WorkflowExecution }) {
  protected baseRepository_: DAL.RepositoryService
  protected workflowExecutionService_: ModulesSdkTypes.IMedusaInternalService<TWorkflowExecution>
  protected workflowOrchestratorService_: WorkflowOrchestratorService
  protected manager_: SqlEntityManager

  constructor(
    {
      manager,
      baseRepository,
      workflowExecutionService,
      workflowOrchestratorService,
    }: InjectedDependencies,
    protected readonly moduleDeclaration: InternalModuleDeclaration
  ) {
    // @ts-ignore
    super(...arguments)

    this.manager_ = manager
    this.baseRepository_ = baseRepository
    this.workflowExecutionService_ = workflowExecutionService
    this.workflowOrchestratorService_ = workflowOrchestratorService
  }

  __hooks = {
    onApplicationStart: async () => {
      await this.workflowOrchestratorService_.onApplicationStart()
    },
    onApplicationShutdown: async () => {
      await this.workflowOrchestratorService_.onApplicationShutdown()
    },
  }

  static prepareFilters<T>(filters: T & { q?: string }) {
    const filters_ = { ...filters } // shallow copy
    if (filters_?.q) {
      const q = filters_.q
      delete filters_.q

      const textSearch = { $ilike: `%${q}%` }
      const textSearchFilters = {
        $or: [
          {
            transaction_id: textSearch,
          },
          {
            workflow_id: textSearch,
          },
          {
            state: textSearch,
          },
          {
            execution: {
              runId: textSearch,
            },
          },
        ],
      }

      if (!Object.keys(filters_).length) {
        return textSearchFilters
      } else {
        return { $and: [filters, textSearchFilters] }
      }
    }

    return filters
  }

  @InjectManager()
  // @ts-expect-error
  async listWorkflowExecutions(
    filters: FilterableWorkflowExecutionProps = {},
    config?: FindConfig<WorkflowExecutionDTO>,
    @MedusaContext() sharedContext?: Context
  ) {
    const filters_ = WorkflowsModuleService.prepareFilters(filters)
    return await super.listWorkflowExecutions(filters_, config, sharedContext)
  }

  @InjectManager()
  // @ts-expect-error
  async listAndCountWorkflowExecutions(
    filters: FilterableWorkflowExecutionProps = {},
    config?: FindConfig<WorkflowExecutionDTO>,
    @MedusaContext() sharedContext?: Context
  ) {
    const filters_ = WorkflowsModuleService.prepareFilters(filters)
    return await super.listAndCountWorkflowExecutions(
      filters_,
      config,
      sharedContext
    )
  }

  @InjectSharedContext()
  async run<TWorkflow extends string | ReturnWorkflow<any, any, any>>(
    workflowIdOrWorkflow: TWorkflow,
    options: WorkflowsSdkTypes.WorkflowOrchestratorRunDTO<
      TWorkflow extends ReturnWorkflow<any, any, any>
        ? UnwrapWorkflowInputDataType<TWorkflow>
        : unknown
    > = {},
    @MedusaContext() context: Context = {}
  ) {
    const options_ = JSON.parse(JSON.stringify(options ?? {}))

    const {
      manager,
      transactionManager,
      preventReleaseEvents,
      transactionId,
      parentStepIdempotencyKey,
      ...restContext
    } = context

    let localPreventReleaseEvents = false

    if (isDefined(options_.context?.preventReleaseEvents)) {
      localPreventReleaseEvents = options_.context!.preventReleaseEvents!
    } else {
      if (
        isDefined(context.eventGroupId) &&
        isDefined(options_.context?.eventGroupId) &&
        context.eventGroupId === options_.context?.eventGroupId
      ) {
        localPreventReleaseEvents = true
      }
    }

    let eventGroupId

    if (options_.context?.eventGroupId) {
      eventGroupId = options_.context.eventGroupId
    } else if (localPreventReleaseEvents && context.eventGroupId) {
      eventGroupId = context.eventGroupId
    }

    options_.context = {
      ...(restContext ?? {}),
      ...(options_.context ?? {}),
      eventGroupId,
      preventReleaseEvents: localPreventReleaseEvents,
    }

    const ret = await this.workflowOrchestratorService_.run<
      TWorkflow extends ReturnWorkflow<any, any, any>
        ? UnwrapWorkflowInputDataType<TWorkflow>
        : unknown
    >(workflowIdOrWorkflow, options_)

    return ret as any
  }

  @InjectSharedContext()
  async getRunningTransaction(
    workflowId: string,
    transactionId: string,
    @MedusaContext() context: Context = {}
  ) {
    return await this.workflowOrchestratorService_.getRunningTransaction(
      workflowId,
      transactionId,
      context
    )
  }

  @InjectSharedContext()
  async setStepSuccess(
    {
      idempotencyKey,
      stepResponse,
      options,
    }: {
      idempotencyKey: string | object
      stepResponse: unknown
      options?: Record<string, any>
    },
    @MedusaContext() context: Context = {}
  ) {
    const options_ = JSON.parse(JSON.stringify(options ?? {}))

    const { manager, transactionManager, ...restContext } = context

    options_.context ??= restContext

    return await this.workflowOrchestratorService_.setStepSuccess({
      idempotencyKey,
      stepResponse,
      options,
    } as any)
  }

  @InjectSharedContext()
  async setStepFailure(
    {
      idempotencyKey,
      stepResponse,
      options,
    }: {
      idempotencyKey: string | object
      stepResponse: unknown
      options?: Record<string, any>
    },
    @MedusaContext() context: Context = {}
  ) {
    const options_ = JSON.parse(JSON.stringify(options ?? {}))

    const { manager, transactionManager, ...restContext } = context

    options_.context ??= restContext

    return await this.workflowOrchestratorService_.setStepFailure({
      idempotencyKey,
      stepResponse,
      options,
    } as any)
  }

  @InjectSharedContext()
  async subscribe(
    args: {
      workflowId: string
      transactionId?: string
      subscriber: Function
      subscriberId?: string
    },
    @MedusaContext() context: Context = {}
  ) {
    return this.workflowOrchestratorService_.subscribe(args as any)
  }

  @InjectSharedContext()
  async unsubscribe(
    args: {
      workflowId: string
      transactionId?: string
      subscriberOrId: string | Function
    },
    @MedusaContext() context: Context = {}
  ) {
    return this.workflowOrchestratorService_.unsubscribe(args as any)
  }

  @InjectSharedContext()
  async cancel<TWorkflow extends string | ReturnWorkflow<any, any, any>>(
    workflowIdOrWorkflow: TWorkflow,
    options: WorkflowOrchestratorCancelOptions,
    @MedusaContext() context: Context = {}
  ) {
    return await this.workflowOrchestratorService_.cancel(
      workflowIdOrWorkflow,
      options
    )
  }
}
