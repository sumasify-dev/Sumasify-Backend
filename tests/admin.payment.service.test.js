import test, { mock } from "node:test";
import assert from "node:assert/strict";

import {
  createAdminPaymentService,
} from "../src/modules/admin/admin.payment.service.js";
import {
  deriveOrderStatusAfterPayment,
} from "../src/modules/orders/order.service.js";

const paymentId = "123e4567-e89b-12d3-a456-426614174000";
const adminUserId = "admin-1";

function paymentFixture(status = "SUBMITTED") {
  return {
    id: paymentId,
    orderId: "order-1",
    status,
    order: {
      id: "order-1",
      orderNumber: "SUM-20261113-0001",
      status: "PAYMENT_REVIEW",
      paymentStatus: "SUBMITTED",
      buyerId: "buyer-1",
    },
  };
}

function decisionResultFixture() {
  return {
    payment: {
      id: paymentId,
      method: "BANK_TRANSFER",
      status: "VERIFIED",
      amount: "42000.00",
      bankReference: "TRF-123",
      submittedAt: new Date("2026-11-13T10:00:00.000Z"),
      verifiedAt: new Date("2026-11-13T11:00:00.000Z"),
      verifiedById: adminUserId,
    },
    order: {
      id: "order-1",
      orderNumber: "SUM-20261113-0001",
      status: "PAID",
      paymentStatus: "VERIFIED",
    },
    vendorgroups: [
      {
        id: "group-1",
        fulfilmentStatus: "NEW",
      },
    ],
    stock: {
      committed: 1,
      released: 0,
    },
  };
}

function createService(overrides = {}) {
  const findPaymentForDecision = mock.fn(
    overrides.findPaymentForDecision ??
      (async () => paymentFixture()),
  );
  const applyPaymentDecision = mock.fn(
    overrides.applyPaymentDecision ??
      (async () => decisionResultFixture()),
  );

  const service = createAdminPaymentService({
    findPaymentForDecision,
    applyPaymentDecision,
  });

  return {
    service,
    findPaymentForDecision,
    applyPaymentDecision,
  };
}

test("verifies a submitted payment and returns the updated state", async () => {
  const { service, applyPaymentDecision } = createService();

  const result = await service.decidePayment({
    paymentId,
    adminUserId,
    decision: "VERIFIED",
    rejectionReason: null,
  });

  assert.equal(result.data.payment.status, "VERIFIED");
  assert.equal(result.data.payment.amount, "42000.00");
  assert.equal(result.data.payment.verifiedbyid, adminUserId);
  assert.equal(result.data.order.status, "PAID");
  assert.equal(result.data.order.paymentstatus, "VERIFIED");
  assert.equal(result.data.vendorgroups[0].fulfilmentstatus, "NEW");
  assert.deepEqual(result.data.stock, {
    committed: 1,
    released: 0,
  });

  assert.deepEqual(
    applyPaymentDecision.mock.calls[0].arguments[0],
    {
      paymentId,
      adminUserId,
      decision: "VERIFIED",
      rejectionReason: null,
    },
  );
});

test("rejects a submitted payment with a trimmed reason", async () => {
  const { service, applyPaymentDecision } = createService({
    applyPaymentDecision: async () => ({
      ...decisionResultFixture(),
      payment: {
        ...decisionResultFixture().payment,
        status: "REJECTED",
        verifiedAt: null,
        verifiedById: null,
      },
      order: {
        ...decisionResultFixture().order,
        status: "PAYMENT_REJECTED",
        paymentStatus: "REJECTED",
      },
      vendorgroups: [
        {
          id: "group-1",
          fulfilmentStatus: "PENDING_PAYMENT",
        },
      ],
      stock: {
        committed: 0,
        released: 1,
      },
    }),
  });

  const result = await service.decidePayment({
    paymentId,
    adminUserId,
    decision: "REJECTED",
    rejectionReason: "  Transfer could not be reconciled.  ",
  });

  assert.equal(result.data.payment.status, "REJECTED");
  assert.equal(result.data.order.status, "PAYMENT_REJECTED");
  assert.equal(result.data.stock.released, 1);
  assert.equal(
    applyPaymentDecision.mock.calls[0].arguments[0].rejectionReason,
    "Transfer could not be reconciled.",
  );
});

test("returns PAYMENT_NOT_FOUND for an unknown payment", async () => {
  const { service } = createService({
    findPaymentForDecision: async () => null,
  });

  await assert.rejects(
    () =>
      service.decidePayment({
        paymentId,
        adminUserId,
        decision: "VERIFIED",
        rejectionReason: null,
      }),
    (error) =>
      error.status === 404 && error.code === "PAYMENT_NOT_FOUND",
  );
});

test("rejects an already verified payment", async () => {
  const { service, applyPaymentDecision } = createService({
    findPaymentForDecision: async () => paymentFixture("VERIFIED"),
  });

  await assert.rejects(
    () =>
      service.decidePayment({
        paymentId,
        adminUserId,
        decision: "VERIFIED",
        rejectionReason: null,
      }),
    (error) =>
      error.status === 409 &&
      error.code === "PAYMENT_ALREADY_VERIFIED",
  );
  assert.equal(applyPaymentDecision.mock.callCount(), 0);
});

test("rejects an already rejected payment", async () => {
  const { service } = createService({
    findPaymentForDecision: async () => paymentFixture("REJECTED"),
  });

  await assert.rejects(
    () =>
      service.decidePayment({
        paymentId,
        adminUserId,
        decision: "VERIFIED",
        rejectionReason: null,
      }),
    (error) => error.code === "PAYMENT_ALREADY_REJECTED",
  );
});

test("rejects a payment that has not been submitted", async () => {
  const { service } = createService({
    findPaymentForDecision: async () =>
      paymentFixture("AWAITING_SUBMISSION"),
  });

  await assert.rejects(
    () =>
      service.decidePayment({
        paymentId,
        adminUserId,
        decision: "VERIFIED",
        rejectionReason: null,
      }),
    (error) => error.code === "PAYMENT_NOT_SUBMITTED",
  );
});

test("requires a rejection reason before looking up the payment", async () => {
  const { service, findPaymentForDecision } = createService();

  await assert.rejects(
    () =>
      service.decidePayment({
        paymentId,
        adminUserId,
        decision: "REJECTED",
        rejectionReason: "   ",
      }),
    (error) =>
      error.status === 400 &&
      error.code === "REJECTION_REASON_REQUIRED",
  );
  assert.equal(findPaymentForDecision.mock.callCount(), 0);
});

test("rejects an unsupported decision before looking up the payment", async () => {
  const { service, findPaymentForDecision } = createService();

  await assert.rejects(
    () =>
      service.decidePayment({
        paymentId,
        adminUserId,
        decision: "APPROVED",
        rejectionReason: null,
      }),
    (error) =>
      error.status === 400 &&
      error.code === "INVALID_PAYMENT_DECISION",
  );
  assert.equal(findPaymentForDecision.mock.callCount(), 0);
});

test("derives parent order status from payment decisions", () => {
  assert.deepEqual(deriveOrderStatusAfterPayment("VERIFIED"), {
    status: "PAID",
    paymentStatus: "VERIFIED",
  });
  assert.deepEqual(deriveOrderStatusAfterPayment("REJECTED"), {
    status: "PAYMENT_REJECTED",
    paymentStatus: "REJECTED",
  });
  assert.deepEqual(deriveOrderStatusAfterPayment("SUBMITTED"), {
    status: "PAYMENT_REVIEW",
    paymentStatus: "SUBMITTED",
  });
});