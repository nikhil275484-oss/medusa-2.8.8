import {
  DistributedTransactionType,
  TransactionState,
  TransactionStep,
  TransactionStepTimeoutError,
  TransactionTimeoutError,
  WorkflowManager,
} from "@medusajs/framework/orchestration"
import {
  IWorkflowEngineService,
  Logger,
  MedusaContainer,
  RemoteQueryFunction,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Module,
  Modules,
  promiseAll,
  TransactionHandlerType,
  TransactionStepState,
} from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { asValue } from "awilix"
import { setTimeout as setTimeoutSync } from "timers"
import { setTimeout } from "timers/promises"
import { ulid } from "ulid"
import { WorkflowsModuleService } from "../../src/services"
import "../__fixtures__"
import {
  workflowNotIdempotentWithRetentionStep2Invoke,
  workflowNotIdempotentWithRetentionStep3Invoke,
} from "../__fixtures__"
import { createScheduled } from "../__fixtures__/workflow_scheduled"
import { TestDatabase } from "../utils"

jest.setTimeout(300000)

const failTrap = (done, name) => {
  setTimeoutSync(() => {
    // REF:https://stackoverflow.com/questions/78028715/jest-async-test-with-event-emitter-isnt-ending
    console.warn(
      `Jest is breaking the event emit with its debouncer. This allows to continue the test by managing the timeout of the test manually. ${name}`
    )
    done()
  }, 5000)
}

function times(num) {
  let resolver
  let counter = 0
  const promise = new Promise((resolve) => {
    resolver = resolve
  })

  return {
    next: () => {
      counter += 1
      if (counter === num) {
        resolver()
      }
    },
    // Force resolution after 10 seconds to prevent infinite awaiting
    promise: Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeoutSync(
          () => reject("times has not been resolved after 10 seconds."),
          10000
        )
      }),
    ]),
  }
}

// REF:https://stackoverflow.com/questions/78028715/jest-async-test-with-event-emitter-isnt-ending

moduleIntegrationTestRunner<IWorkflowEngineService>({
  moduleName: Modules.WORKFLOW_ENGINE,
  resolve: __dirname + "/../..",
  moduleOptions: {
    redis: {
      url: "localhost:6379",
    },
  },
  testSuite: ({ service: workflowOrcModule, medusaApp }) => {
    describe("Workflow Orchestrator module", function () {
      beforeEach(async () => {
        await TestDatabase.clearTables()
        jest.clearAllMocks()
      })

      let query: RemoteQueryFunction
      let sharedContainer_: MedusaContainer

      beforeEach(() => {
        query = medusaApp.query
        sharedContainer_ = medusaApp.sharedContainer
      })

      it(`should export the appropriate linkable configuration`, () => {
        const linkable = Module(Modules.WORKFLOW_ENGINE, {
          service: WorkflowsModuleService,
        }).linkable

        expect(Object.keys(linkable)).toEqual(["workflowExecution"])

        Object.keys(linkable).forEach((key) => {
          delete linkable[key].toJSON
        })

        expect(linkable).toEqual({
          workflowExecution: {
            id: {
              linkable: "workflow_execution_id",
              entity: "WorkflowExecution",
              primaryKey: "id",
              serviceName: "workflows",
              field: "workflowExecution",
            },
            transaction_id: {
              entity: "WorkflowExecution",
              field: "workflowExecution",
              linkable: "workflow_execution_transaction_id",
              primaryKey: "transaction_id",
              serviceName: "workflows",
            },
            workflow_id: {
              entity: "WorkflowExecution",
              field: "workflowExecution",
              linkable: "workflow_execution_workflow_id",
              primaryKey: "workflow_id",
              serviceName: "workflows",
            },
            run_id: {
              entity: "WorkflowExecution",
              field: "workflowExecution",
              linkable: "workflow_execution_run_id",
              primaryKey: "run_id",
              serviceName: "workflows",
            },
          },
        })
      })

      describe("Testing basic workflow", function () {
        describe("Cancel transaction", function () {
          it("should cancel an ongoing execution with async unfinished yet step", (done) => {
            const transactionId = "transaction-to-cancel-id"
            const step1 = createStep("step1", async () => {
              return new StepResponse("step1")
            })

            const step2 = createStep("step2", async () => {
              await setTimeout(500)
              return new StepResponse("step2")
            })

            const step3 = createStep("step3", async () => {
              return new StepResponse("step3")
            })

            const workflowId = "workflow-to-cancel-id" + ulid()

            createWorkflow(
              { name: workflowId, retentionTime: 60 },
              function () {
                step1()
                step2().config({ async: true })
                step3()

                return new WorkflowResponse("finished")
              }
            )

            workflowOrcModule
              .run(workflowId, {
                input: {},
                transactionId,
              })
              .then(async () => {
                await setTimeout(100)

                await workflowOrcModule.cancel(workflowId, {
                  transactionId,
                })

                workflowOrcModule.subscribe({
                  workflowId,
                  transactionId,
                  subscriber: async (event) => {
                    if (event.eventType === "onFinish") {
                      const execution =
                        await workflowOrcModule.listWorkflowExecutions({
                          transaction_id: transactionId,
                        })

                      expect(execution.length).toEqual(1)
                      expect(execution[0].state).toEqual(
                        TransactionState.REVERTED
                      )
                      done()
                    }
                  },
                })
              })

            failTrap(
              done,
              "should cancel an ongoing execution with async unfinished yet step"
            )
          })

          it("should cancel a complete execution with a sync workflow running as async", async () => {
            const workflowId = "workflow-to-cancel-id" + ulid()
            const transactionId = "transaction-to-cancel-id"
            const step1 = createStep("step1", async () => {
              return new StepResponse("step1")
            })

            const step2 = createStep("step2", async () => {
              return new StepResponse("step2")
            })

            const step3 = createStep("step3", async () => {
              return new StepResponse("step3")
            })

            const subWorkflowId = "sub-workflow-id" + ulid()
            const subWorkflow = createWorkflow(
              { name: subWorkflowId, retentionTime: 60 },
              function () {
                return new WorkflowResponse(step2())
              }
            )

            createWorkflow(
              { name: workflowId, retentionTime: 60 },
              function () {
                step1()
                subWorkflow.runAsStep({ input: {} }).config({ async: true })
                step3()

                return new WorkflowResponse("finished")
              }
            )

            await workflowOrcModule.run(workflowId, {
              input: {},
              transactionId,
            })

            await setTimeout(100)

            await workflowOrcModule.cancel(workflowId, {
              transactionId,
            })

            await setTimeout(500)

            const execution = await workflowOrcModule.listWorkflowExecutions({
              transaction_id: transactionId,
            })

            expect(execution.length).toEqual(1)
            expect(execution[0].state).toEqual(TransactionState.REVERTED)
          })

          it("should cancel an ongoing execution with a sync workflow running as async", async () => {
            const workflowId = "workflow-to-cancel-id" + ulid()
            const transactionId = "transaction-to-cancel-id"
            const step1 = createStep("step1", async () => {
              return new StepResponse("step1")
            })

            const step2 = createStep("step2", async () => {
              await setTimeout(500)
              return new StepResponse("step2")
            })

            const step3 = createStep("step3", async () => {
              return new StepResponse("step3")
            })

            const subWorkflowId = "sub-workflow-id" + ulid()
            const subWorkflow = createWorkflow(
              { name: subWorkflowId, retentionTime: 60 },
              function () {
                return new WorkflowResponse(step2())
              }
            )

            createWorkflow(
              { name: workflowId, retentionTime: 60 },
              function () {
                step1()
                subWorkflow.runAsStep({ input: {} }).config({ async: true })
                step3()

                return new WorkflowResponse("finished")
              }
            )

            await workflowOrcModule.run(workflowId, {
              input: {},
              transactionId,
            })

            await setTimeout(100)

            await workflowOrcModule.cancel(workflowId, {
              transactionId,
            })

            await setTimeout(1000)

            const execution = await workflowOrcModule.listWorkflowExecutions({
              transaction_id: transactionId,
            })

            expect(execution.length).toEqual(1)
            expect(execution[0].state).toEqual(TransactionState.REVERTED)
          })

          it("should cancel an ongoing execution with sync steps only", async () => {
            const transactionId = "transaction-to-cancel-id"
            const step1 = createStep("step1", async () => {
              return new StepResponse("step1")
            })

            const step2 = createStep("step2", async () => {
              await setTimeout(500)
              return new StepResponse("step2")
            })

            const step3 = createStep("step3", async () => {
              return new StepResponse("step3")
            })

            const workflowId = "workflow-to-cancel-id" + ulid()

            createWorkflow(
              { name: workflowId, retentionTime: 60 },
              function () {
                step1()
                step2()
                step3()

                return new WorkflowResponse("finished")
              }
            )

            await workflowOrcModule.run(workflowId, {
              input: {},
              transactionId,
            })

            await setTimeout(100)

            await workflowOrcModule.cancel(workflowId, {
              transactionId,
            })

            await setTimeout(1000)

            const execution = await workflowOrcModule.listWorkflowExecutions({
              transaction_id: transactionId,
            })

            expect(execution.length).toEqual(1)
            expect(execution[0].state).toEqual(TransactionState.REVERTED)
          })
        })

        it("should prevent executing twice the same workflow in perfect concurrency with the same transactionId and non idempotent and not async but retention time is set", async () => {
          const transactionId = "concurrency_transaction_id"
          const workflowId = "concurrency_workflow_id" + ulid()

          const step1 = createStep("step1", async () => {
            await setTimeout(100)
            return new StepResponse("step1")
          })

          createWorkflow(
            {
              name: workflowId,
              retentionTime: 1000,
            },
            function () {
              return new WorkflowResponse(step1())
            }
          )

          const [result1, result2] = await promiseAll([
            workflowOrcModule
              .run(workflowId, {
                input: {},
                transactionId,
              })
              .catch((e) => e),
            workflowOrcModule
              .run(workflowId, {
                input: {},
                transactionId,
              })
              .catch((e) => e),
          ])

          expect(result1.result || result2.result).toEqual("step1")
          expect(result2.message || result1.message).toEqual(
            "Transaction already started for transactionId: " + transactionId
          )
        })

        it("should return a list of workflow executions and remove after completed when there is no retentionTime set", async () => {
          await workflowOrcModule.run("workflow_1", {
            input: {
              value: "123",
            },
            throwOnError: true,
          })

          let { data: executionsList } = await query.graph({
            entity: "workflow_executions",
            fields: ["workflow_id", "transaction_id", "state"],
          })

          expect(executionsList).toHaveLength(1)

          const { result } = await workflowOrcModule.setStepSuccess({
            idempotencyKey: {
              action: TransactionHandlerType.INVOKE,
              stepId: "new_step_name",
              workflowId: "workflow_1",
              transactionId: executionsList[0].transaction_id,
            },
            stepResponse: { uhuuuu: "yeaah!" },
          })

          ;({ data: executionsList } = await query.graph({
            entity: "workflow_executions",
            fields: ["id"],
          }))

          expect(executionsList).toHaveLength(0)
          expect(result).toEqual({
            done: {
              inputFromSyncStep: "oh",
            },
          })
        })

        it("should return a list of workflow executions and keep it saved when there is a retentionTime set", async () => {
          await workflowOrcModule.run("workflow_2", {
            input: {
              value: "123",
            },
            throwOnError: true,
            transactionId: "transaction_1",
          })

          let { data: executionsList } = await query.graph({
            entity: "workflow_executions",
            fields: ["id"],
          })

          expect(executionsList).toHaveLength(1)

          await workflowOrcModule.setStepSuccess({
            idempotencyKey: {
              action: TransactionHandlerType.INVOKE,
              stepId: "new_step_name",
              workflowId: "workflow_2",
              transactionId: "transaction_1",
            },
            stepResponse: { uhuuuu: "yeaah!" },
          })
          ;({ data: executionsList } = await query.graph({
            entity: "workflow_executions",
            fields: ["id"],
          }))

          expect(executionsList).toHaveLength(1)
        })

        it("should return a list of failed workflow executions and keep it saved when there is a retentionTime set", async () => {
          await workflowOrcModule.run("workflow_2", {
            input: {
              value: "123",
            },
            transactionId: "transaction_1",
          })

          let { data: executionsList } = await query.graph({
            entity: "workflow_executions",
            fields: ["id"],
          })

          expect(executionsList).toHaveLength(1)

          await workflowOrcModule.setStepFailure({
            idempotencyKey: {
              action: TransactionHandlerType.INVOKE,
              stepId: "new_step_name",
              workflowId: "workflow_2",
              transactionId: "transaction_1",
            },
            stepResponse: { uhuuuu: "yeaah!" },
            options: {
              throwOnError: false,
            },
          })
          ;({ data: executionsList } = await query.graph({
            entity: "workflow_executions",
            fields: ["id", "state"],
          }))

          expect(executionsList).toHaveLength(1)
          expect(executionsList[0].state).toEqual("reverted")
        })

        it("should throw if setStepFailure fails", async () => {
          const { acknowledgement } = await workflowOrcModule.run(
            "workflow_2_revert_fail",
            {
              input: {
                value: "123",
              },
            }
          )

          let done = false
          void workflowOrcModule.subscribe({
            workflowId: "workflow_2_revert_fail",
            transactionId: acknowledgement.transactionId,
            subscriber: (event) => {
              if (event.eventType === "onFinish") {
                done = true
              }
            },
          })

          let { data: executionsList } = await query.graph({
            entity: "workflow_executions",
            fields: ["id"],
          })

          expect(executionsList).toHaveLength(1)

          const setStepError = await workflowOrcModule
            .setStepFailure({
              idempotencyKey: {
                action: TransactionHandlerType.INVOKE,
                stepId: "broken_step_2",
                workflowId: "workflow_2_revert_fail",
                transactionId: acknowledgement.transactionId,
              },
              stepResponse: { uhuuuu: "yeaah!" },
            })
            .catch((e) => {
              return e
            })

          expect(setStepError).toEqual(
            expect.objectContaining({
              message: JSON.stringify({
                uhuuuu: "yeaah!",
              }),
              stack: expect.any(String),
            })
          )
          ;({ data: executionsList } = await query.graph({
            entity: "workflow_executions",
            fields: ["id", "state", "context"],
          }))

          expect(executionsList).toHaveLength(1)
          expect(executionsList[0].state).toEqual("failed")
          expect(done).toBe(true)
        })

        it("should return a list of workflow executions and keep it saved when there is a retentionTime set but allow for executing the same workflow multiple times with different run_id if the workflow is considered done", async () => {
          const transactionId = "transaction_1"
          await workflowOrcModule.run(
            "workflow_not_idempotent_with_retention",
            {
              input: {
                value: "123",
              },
              transactionId,
            }
          )

          let { data: executionsList } = await query.graph({
            entity: "workflow_executions",
            fields: ["id", "run_id", "transaction_id"],
          })

          expect(executionsList).toHaveLength(1)

          expect(
            workflowNotIdempotentWithRetentionStep2Invoke
          ).toHaveBeenCalledTimes(2)
          expect(
            workflowNotIdempotentWithRetentionStep2Invoke.mock.calls[0][0]
          ).toEqual({ hey: "oh" })
          expect(
            workflowNotIdempotentWithRetentionStep2Invoke.mock.calls[1][0]
          ).toEqual({
            hey: "hello",
          })
          expect(
            workflowNotIdempotentWithRetentionStep3Invoke
          ).toHaveBeenCalledTimes(1)
          expect(
            workflowNotIdempotentWithRetentionStep3Invoke.mock.calls[0][0]
          ).toEqual({
            notAsyncResponse: "hello",
          })

          await workflowOrcModule.run(
            "workflow_not_idempotent_with_retention",
            {
              input: {
                value: "123",
              },
              transactionId,
            }
          )

          const { data: executionsList2 } = await query.graph({
            entity: "workflow_executions",
            filters: {
              id: { $nin: executionsList.map((e) => e.id) },
            },
            fields: ["id", "run_id", "transaction_id"],
          })

          expect(executionsList2).toHaveLength(1)
          expect(executionsList2[0].run_id).not.toEqual(
            executionsList[0].run_id
          )
          expect(executionsList2[0].transaction_id).toEqual(
            executionsList[0].transaction_id
          )
        })

        it("should revert the entire transaction when a step timeout expires", async () => {
          const { transaction, result, errors } = (await workflowOrcModule.run(
            "workflow_step_timeout",
            {
              input: {
                myInput: "123",
              },
              throwOnError: false,
              logOnError: true,
            }
          )) as Awaited<{
            transaction: DistributedTransactionType
            result: any
            errors: any
          }>

          expect(transaction.getFlow().state).toEqual("reverted")
          expect(result).toEqual({
            myInput: "123",
          })
          expect(errors).toHaveLength(1)
          expect(errors[0].action).toEqual("step_1")
          expect(errors[0].error).toBeInstanceOf(TransactionStepTimeoutError)
        })

        it("should revert the entire transaction when the transaction timeout expires", async () => {
          const { transaction, result, errors } = (await workflowOrcModule.run(
            "workflow_transaction_timeout",
            {
              input: {},
              transactionId: "trx" + ulid(),
              throwOnError: false,
            }
          )) as Awaited<{
            transaction: DistributedTransactionType
            result: any
            errors: any
          }>

          await setTimeout(500)

          expect(transaction.getFlow().state).toEqual("reverted")
          expect(result).toEqual({ executed: true })
          expect(errors).toHaveLength(1)
          expect(errors[0].action).toEqual("step_1")
          expect(
            TransactionTimeoutError.isTransactionTimeoutError(errors[0].error)
          ).toBe(true)
        })

        it("should revert the entire transaction when a step timeout expires in a async step", async () => {
          await workflowOrcModule.run("workflow_step_timeout_async", {
            input: {
              myInput: "123",
            },
            transactionId: "transaction_1",
            throwOnError: false,
          })

          await setTimeout(2000)

          const { transaction, result, errors } = (await workflowOrcModule.run(
            "workflow_step_timeout_async",
            {
              input: {
                myInput: "123",
              },
              transactionId: "transaction_1",
              throwOnError: false,
            }
          )) as Awaited<{
            transaction: DistributedTransactionType
            result: any
            errors: any
          }>

          expect(transaction.getFlow().state).toEqual("reverted")
          expect(result).toEqual(undefined)
          expect(errors).toHaveLength(1)
          expect(errors[0].action).toEqual("step_1_async")
          expect(
            TransactionStepTimeoutError.isTransactionStepTimeoutError(
              errors[0].error
            )
          ).toBe(true)
        })

        it("should revert the entire transaction when the transaction timeout expires in a transaction containing an async step", async () => {
          const transactionId = "transaction_1" + ulid()
          await workflowOrcModule.run("workflow_transaction_timeout_async", {
            input: {},
            transactionId,
            throwOnError: false,
          })

          await setTimeout(500)

          const { transaction, result, errors } = (await workflowOrcModule.run(
            "workflow_transaction_timeout_async",
            {
              input: {},
              transactionId,
              throwOnError: false,
            }
          )) as Awaited<{
            transaction: DistributedTransactionType
            result: any
            errors: any
          }>

          expect(transaction.getFlow().state).toEqual("reverted")
          expect(result).toEqual(undefined)
          expect(errors).toHaveLength(1)
          expect(errors[0].action).toEqual("step_1_async")
          expect(
            TransactionTimeoutError.isTransactionTimeoutError(errors[0].error)
          ).toBe(true)
        })

        it("should complete an async workflow that returns a StepResponse", (done) => {
          const transactionId = "transaction_1"
          workflowOrcModule
            .run("workflow_async_background", {
              input: {
                myInput: "123",
              },
              transactionId,
              throwOnError: true,
            })
            .then(({ transaction, result }: any) => {
              expect(transaction.flow.state).toEqual(
                TransactionStepState.INVOKING
              )
              expect(result).toEqual(undefined)
            })

          void workflowOrcModule.subscribe({
            workflowId: "workflow_async_background",
            transactionId,
            subscriber: (event) => {
              if (event.eventType === "onFinish") {
                done()
              }
            },
          })

          failTrap(done, "workflow_async_background")
        })

        it("should subscribe to a async workflow and receive the response when it finishes", (done) => {
          const transactionId = "trx_123"

          const onFinish = jest.fn()

          void workflowOrcModule.run("workflow_async_background", {
            input: {
              myInput: "123",
            },
            transactionId,
            throwOnError: false,
          })

          void workflowOrcModule.subscribe({
            workflowId: "workflow_async_background",
            transactionId,
            subscriber: (event) => {
              if (event.eventType === "onFinish") {
                onFinish()
                done()
              }
            },
          })

          expect(onFinish).toHaveBeenCalledTimes(0)

          failTrap(done, "workflow_async_background")
        })

        it("should not skip step if condition is true", function (done) {
          void workflowOrcModule.run("wf-when", {
            input: {
              callSubFlow: true,
            },
            transactionId: "trx_123_when",
            throwOnError: true,
            logOnError: true,
          })

          void workflowOrcModule.subscribe({
            workflowId: "wf-when",
            transactionId: "trx_123_when",
            subscriber: (event) => {
              if (event.eventType === "onFinish") {
                done()
              }
            },
          })

          failTrap(done, "wf-when")
        })

        it("should cancel an async sub workflow when compensating", (done) => {
          const workflowId = "workflow_async_background_fail"

          void workflowOrcModule.run(workflowId, {
            input: {
              callSubFlow: true,
            },
            transactionId: "trx_123_compensate_async_sub_workflow",
            throwOnError: false,
            logOnError: false,
          })

          let onCompensateStepSuccess: { step: TransactionStep } | null = null

          void workflowOrcModule.subscribe({
            workflowId,
            subscriber: (event) => {
              if (event.eventType === "onCompensateStepSuccess") {
                onCompensateStepSuccess = event
              }
              if (event.eventType === "onFinish") {
                expect(onCompensateStepSuccess).toBeDefined()
                expect(onCompensateStepSuccess!.step.id).toEqual(
                  "_root.nested_sub_flow_async_fail-as-step" // The workflow as step
                )
                expect(onCompensateStepSuccess!.step.compensate).toEqual({
                  state: "reverted",
                  status: "ok",
                })

                done()
              }
            },
          })

          failTrap(done, "workflow_async_background_fail")
        })

        it("should cancel and revert a completed workflow", async () => {
          const workflowId = "workflow_sync"

          const { acknowledgement, transaction: trx } =
            await workflowOrcModule.run(workflowId, {
              input: {
                value: "123",
              },
            })

          expect(trx.getFlow().state).toEqual("done")
          expect(acknowledgement.hasFinished).toBe(true)

          const { transaction } = await workflowOrcModule.cancel(workflowId, {
            transactionId: acknowledgement.transactionId,
          })

          expect(transaction.getFlow().state).toEqual("reverted")
        })
      })

      describe("Testing complex workflows", function () {
        it("should execute workflow + workflow as step + manual workflow within a step correctly", async () => {
          const workflowA_id = "workflow_a"
          const workflowB_id = "workflow_b"
          const workflowC_id = "workflow_c"

          const stepB_1 = createStep("stepB_1", async (input, context) => {
            let results: any[] = []
            for (let i = 0; i < 2; i++) {
              const { result } = await workflowOrcModule.run(workflowC_id, {
                input: {},
              })

              results.push(result)
            }

            return new StepResponse(results)
          })

          const stepC_1 = createStep("stepC_1", async (input, context) => {
            return new StepResponse({
              stepC_1_result: "stepC_1_result",
            })
          })

          createWorkflow(workflowC_id, (input) => {
            const result = stepC_1()
            return new WorkflowResponse(result)
          })

          const workflowB = createWorkflow(workflowB_id, (input) => {
            const result = stepB_1()
            return new WorkflowResponse(result)
          })

          createWorkflow(workflowA_id, (input) => {
            const workflowB_response = workflowB.runAsStep({
              input: {},
            })

            return new WorkflowResponse({ workflowB_response })
          })

          const { result } = await workflowOrcModule.run(workflowA_id, {
            input: {},
            throwOnError: false,
          })

          expect(result).toEqual({
            workflowB_response: [
              {
                stepC_1_result: "stepC_1_result",
              },
              {
                stepC_1_result: "stepC_1_result",
              },
            ],
          })
        })

        it("should execute workflow + workflow as step + manual workflow within a step that fail but do not fail the step", async () => {
          const workflowA_id = "workflow_a"
          const workflowB_id = "workflow_b"
          const workflowC_id = "workflow_c"

          const stepB_1 = createStep("stepB_1", async (input, context) => {
            let results: any[] = []
            for (let i = 0; i < 2; i++) {
              const { errors } = await workflowOrcModule.run(workflowC_id, {
                input: {},
                throwOnError: false,
              })

              results.push(errors)
            }

            return new StepResponse(results)
          })

          const stepC_1 = createStep("stepC_1", async (input, context) => {
            throw new Error("Workflow C failed")
          })

          createWorkflow(workflowC_id, (input) => {
            const result = stepC_1()
            return new WorkflowResponse(result)
          })

          const workflowB = createWorkflow(workflowB_id, (input) => {
            const result = stepB_1()
            return new WorkflowResponse(result)
          })

          createWorkflow(workflowA_id, (input) => {
            const workflowB_response = workflowB.runAsStep({
              input: {},
            })

            return new WorkflowResponse({ workflowB_response })
          })

          const { result, transaction } = await workflowOrcModule.run(
            workflowA_id,
            {
              input: {},
              throwOnError: false,
            }
          )

          expect(
            (transaction as DistributedTransactionType).getFlow().state
          ).toEqual(TransactionState.DONE)
          expect(result).toEqual({
            workflowB_response: [
              [
                {
                  action: "stepC_1",
                  handlerType: TransactionHandlerType.INVOKE,
                  error: expect.objectContaining({
                    message: "Workflow C failed",
                  }),
                },
              ],
              [
                {
                  action: "stepC_1",
                  handlerType: TransactionHandlerType.INVOKE,
                  error: expect.objectContaining({
                    message: "Workflow C failed",
                  }),
                },
              ],
            ],
          })
        })
      })

      // Note: These tests depend on actual Redis instance and waiting for the scheduled jobs to run, which isn't great.
      // Mocking bullmq, however, would make the tests close to useless, so we can keep them very minimal and serve as smoke tests.
      describe.skip("Scheduled workflows", () => {
        beforeEach(() => {
          jest.clearAllMocks()
        })

        it("should execute a scheduled workflow", async () => {
          const wait = times(2)
          const spy = createScheduled("standard", wait.next)

          await wait.promise
          expect(spy).toHaveBeenCalledTimes(2)
          WorkflowManager.unregister("standard")
        })

        it("should stop executions after the set number of executions", async () => {
          const wait = times(2)
          const spy = createScheduled("num-executions", wait.next, {
            interval: 1000,
            numberOfExecutions: 2,
          })

          await wait.promise
          expect(spy).toHaveBeenCalledTimes(2)

          // Make sure that on the next tick it doesn't execute again
          await setTimeout(1100)
          expect(spy).toHaveBeenCalledTimes(2)

          WorkflowManager.unregister("num-execution")
        })

        it("should remove scheduled workflow if workflow no longer exists", async () => {
          const wait = times(1)
          const logger = sharedContainer_.resolve<Logger>(
            ContainerRegistrationKeys.LOGGER
          )

          const spy = createScheduled("remove-scheduled", wait.next, {
            interval: 1000,
          })
          const logSpy = jest.spyOn(logger, "warn")

          await wait.promise
          expect(spy).toHaveBeenCalledTimes(1)
          WorkflowManager["workflows"].delete("remove-scheduled")

          await setTimeout(1100)
          expect(spy).toHaveBeenCalledTimes(1)
          expect(logSpy).toHaveBeenCalledWith(
            "Tried to execute a scheduled workflow with ID remove-scheduled that does not exist, removing it from the scheduler."
          )
        })

        // TODO: investigate why sometimes flow doesn't have access to the new key registered
        describe.skip("Scheduled workflows", () => {
          beforeEach(() => {
            sharedContainer_.register("test-value", asValue("test"))
          })

          it("the scheduled workflow should have access to the shared container", async () => {
            const wait = times(1)

            const spy = await createScheduled(
              "shared-container-job",
              wait.next,
              {
                interval: 1000,
              }
            )
            await wait.promise

            expect(spy).toHaveBeenCalledTimes(1)

            console.log(spy.mock.results)
            expect(spy).toHaveReturnedWith(
              expect.objectContaining({ output: { testValue: "test" } })
            )
            WorkflowManager.unregister("shared-container-job")
          })
        })
      })

      describe("Cleaner job", function () {
        it("should remove expired executions of finished workflows and keep the others", async () => {
          const doneWorkflowId = "done-workflow-" + ulid()
          createWorkflow({ name: doneWorkflowId, retentionTime: 1 }, () => {
            return new WorkflowResponse("done")
          })

          const failingWorkflowId = "failing-workflow-" + ulid()
          const failingStep = createStep("failing-step", () => {
            throw new Error("I am failing")
          })
          createWorkflow({ name: failingWorkflowId, retentionTime: 1 }, () => {
            failingStep()
          })

          const revertingStep = createStep(
            "reverting-step",
            () => {
              throw new Error("I am reverting")
            },
            () => {
              return new StepResponse("reverted")
            }
          )

          const revertingWorkflowId = "reverting-workflow-" + ulid()
          createWorkflow(
            { name: revertingWorkflowId, retentionTime: 1 },
            () => {
              revertingStep()
              return new WorkflowResponse("reverted")
            }
          )

          const runningWorkflowId = "running-workflow-" + ulid()
          const longRunningStep = createStep("long-running-step", async () => {
            await setTimeout(10000)
            return new StepResponse("long running finished")
          })
          createWorkflow({ name: runningWorkflowId, retentionTime: 1 }, () => {
            longRunningStep().config({ async: true, backgroundExecution: true })
            return new WorkflowResponse("running workflow started")
          })

          const notExpiredWorkflowId = "not-expired-workflow-" + ulid()
          createWorkflow(
            { name: notExpiredWorkflowId, retentionTime: 10000 },
            () => {
              return new WorkflowResponse("not expired")
            }
          )

          const trx_done = "trx-done-" + ulid()
          const trx_failed = "trx-failed-" + ulid()
          const trx_reverting = "trx-reverting-" + ulid()
          const trx_running = "trx-running-" + ulid()
          const trx_not_expired = "trx-not-expired-" + ulid()

          // run workflows
          await workflowOrcModule.run(doneWorkflowId, {
            transactionId: trx_done,
          })

          await workflowOrcModule.run(failingWorkflowId, {
            transactionId: trx_failed,
            throwOnError: false,
          })

          await workflowOrcModule.run(revertingWorkflowId, {
            transactionId: trx_reverting,
            throwOnError: false,
          })

          await workflowOrcModule.run(runningWorkflowId, {
            transactionId: trx_running,
          })

          await workflowOrcModule.run(notExpiredWorkflowId, {
            transactionId: trx_not_expired,
          })

          let executions = await workflowOrcModule.listWorkflowExecutions()
          expect(executions).toHaveLength(5)

          await setTimeout(2000)

          // Manually trigger cleaner
          await (workflowOrcModule as any).workflowOrchestratorService_[
            "redisDistributedTransactionStorage_"
          ]["clearExpiredExecutions"]()

          let remainingExecutions =
            await workflowOrcModule.listWorkflowExecutions()

          expect(remainingExecutions).toHaveLength(2)

          const remainingTrxIds = remainingExecutions
            .map((e) => e.transaction_id)
            .sort()

          expect(remainingTrxIds).toEqual([trx_not_expired, trx_running].sort())

          const notExpiredExec = remainingExecutions.find(
            (e) => e.transaction_id === trx_not_expired
          )
          expect(notExpiredExec?.state).toBe(TransactionState.DONE)

          const runningExec = remainingExecutions.find(
            (e) => e.transaction_id === trx_running
          )
          expect(runningExec?.state).toBe(TransactionState.INVOKING)
        })
      })
    })
  },
})
