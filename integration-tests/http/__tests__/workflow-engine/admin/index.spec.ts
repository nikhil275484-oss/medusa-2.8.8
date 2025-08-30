import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowData,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/utils"
import {
  adminHeaders,
  createAdminUser,
} from "../../../../helpers/create-admin-user"

jest.setTimeout(300000)

medusaIntegrationTestRunner({
  testSuite: ({ dbConnection, getContainer, api }) => {
    let container

    beforeEach(async () => {
      container = getContainer()
      await createAdminUser(dbConnection, adminHeaders, container)
    })

    describe("GET /admin/workflow-executions", () => {
      it("should filter using q", async () => {
        const step1 = createStep(
          {
            name: "my-step",
          },
          async (_) => {
            return new StepResponse({ result: "success" })
          }
        )

        const workflowName = "workflow-admin/workflow-executions"
        createWorkflow(
          {
            name: workflowName,
            retentionTime: 50,
          },
          function (input: WorkflowData<{ initial: string }>) {
            const stepRes = step1()

            return new WorkflowResponse(stepRes)
          }
        )

        const engine = container.resolve(Modules.WORKFLOW_ENGINE)

        const transactionId = "test-transaction-id"
        await engine.run(workflowName, {
          transactionId,
          input: {
            initial: "test",
          },
        })

        const transactionId2 = "unknown"
        await engine.run(workflowName, {
          transactionId: transactionId2,
          input: {
            initial: "test",
          },
        })

        const q = "transaction-id"
        const response = await api.get(
          `/admin/workflows-executions?q=${q}`,
          adminHeaders
        )

        expect(response.status).toEqual(200)
        expect(response.data.workflow_executions.length).toEqual(1)
        expect(response.data.workflow_executions[0].transaction_id).toEqual(
          transactionId
        )

        const q2 = "known"
        const response2 = await api.get(
          `/admin/workflows-executions?q=${q2}`,
          adminHeaders
        )

        expect(response2.status).toEqual(200)
        expect(response2.data.workflow_executions.length).toEqual(1)
        expect(response2.data.workflow_executions[0].transaction_id).toEqual(
          transactionId2
        )
      })
    })
  },
})
