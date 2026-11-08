// The account_deletion_request table is additive and holds no secrets.
import { getTableColumns } from "drizzle-orm";
import { accountDeletionRequest } from "@/db/schema";

describe("account_deletion_request schema", () => {
  it("has the columns the request flow needs", () => {
    const cols = Object.keys(getTableColumns(accountDeletionRequest));
    expect(cols).toEqual(
      expect.arrayContaining([
        "id",
        "userId",
        "billingAccountId",
        "requestedAt",
        "scheduledFor",
        "status",
        "reason",
        "cancelledAt",
        "completedAt",
      ]),
    );
  });
});
