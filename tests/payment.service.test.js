import test from "node:test";
import assert from "node:assert/strict";

import { createPaymentService } from "../src/modules/payments/payment.service.js";

const buyerId = "buyer-123";
const orderId = "order-123";
const idempotencyKey = "payment-key-123";
const bankReference = "TRF-123456789";

const order = {
  id: orderId,
  buyerId,
  orderNumber: "SUM-20260915-0001",
  totalAmount: {
    toFixed: () => "43000.00",
  },
  status: "AWAITING_PAYMENT",
  paymentStatus: "AWAITING_SUBMISSION",
};

const payment = {
  id: "payment-123",
  orderId,
  status: "SUBMITTED",
  amount: {
    toFixed: () => "43000.00",
  },
  bankReference,
  idempotencyKey,
  submittedAt: new Date("2026-09-15T10:00:00.000Z"),
};

const updatedOrder = {
  id: orderId,
  orderNumber: "SUM-20260915-0001",
  status: "PAYMENT_REVIEW",
  paymentStatus: "SUBMITTED",
};

function createTestService(overrides = {}) {
  const dependencies = {
    findOrderForPayment: async () => order,
    findPaymentByIdempotencyKey: async () => null,
    findPaymentByBankReference: async () => null,
    createPaymentSubmission: async () => ({
      payment,
      order: updatedOrder,
    }),
    ...overrides,
  };

  return {
    service: createPaymentService(dependencies),
    dependencies,
  };
}

// 1. Successful payment submission.
test("should submit a bank transfer successfully", async () => {
  const { service } = createTestService();

  const result = await service.submitBankTransfer({
    orderId,
    buyerId,
    bankReference,
    idempotencyKey,
  });

  assert.deepEqual(result, {
    data: {
      payment: {
        id: payment.id,
        status: "SUBMITTED",
        amount: "43000.00",
        bankreference: bankReference,
        submittedat: payment.submittedAt,
      },
      order: {
        id: orderId,
        ordernumber: updatedOrder.orderNumber,
        status: "PAYMENT_REVIEW",
        paymentstatus: "SUBMITTED",
      },
    },
  });
});

// 2. Order does not exist.
test("should throw 404 when the order does not exist", async () => {
  const { service } = createTestService({
    findOrderForPayment: async () => null,
  });

  await assert.rejects(
    service.submitBankTransfer({
      orderId,
      buyerId,
      bankReference,
      idempotencyKey,
    }),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.code, "ORDER_NOT_FOUND");
      return true;
    }
  );
});

// 3. Buyer does not own the order.
test("should throw 403 when the buyer does not own the order", async () => {
  const { service } = createTestService({
    findOrderForPayment: async () => ({
      ...order,
      buyerId: "another-buyer",
    }),
  });

  await assert.rejects(
    service.submitBankTransfer({
      orderId,
      buyerId,
      bankReference,
      idempotencyKey,
    }),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.code, "ORDER_FORBIDDEN");
      return true;
    }
  );
});

// 4. Order is not in an eligible payment state.
test("should reject payment when the order is not awaiting payment", async () => {
  const { service } = createTestService({
    findOrderForPayment: async () => ({
      ...order,
      status: "PAYMENT_REVIEW",
      paymentStatus: "SUBMITTED",
    }),
  });

  await assert.rejects(
    service.submitBankTransfer({
      orderId,
      buyerId,
      bankReference,
      idempotencyKey,
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "INVALID_PAYMENT_STATE");
      return true;
    }
  );
});

// 5. Bank reference has already been used.
test("should reject a duplicate bank reference", async () => {
  const { service } = createTestService({
    findPaymentByBankReference: async () => payment,
  });

  await assert.rejects(
    service.submitBankTransfer({
      orderId,
      buyerId,
      bankReference,
      idempotencyKey,
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "DUPLICATE_BANK_REFERENCE");
      return true;
    }
  );
});

// 6. Idempotency key has already processed the same request.
test("should return the existing payment for an identical idempotent request", async () => {
  const { service } = createTestService({
    findPaymentByIdempotencyKey: async () => payment,
  });

  const result = await service.submitBankTransfer({
    orderId,
    buyerId,
    bankReference,
    idempotencyKey,
  });

  assert.equal(result.data.payment.id, payment.id);
  assert.equal(result.data.payment.status, "SUBMITTED");
});

// 7. Idempotency key is reused for a different request.
test("should reject an idempotency key reused for another request", async () => {
  const { service } = createTestService({
    findPaymentByIdempotencyKey: async () => payment,
  });

  await assert.rejects(
    service.submitBankTransfer({
      orderId,
      buyerId,
      bankReference: "TRF-DIFFERENT",
      idempotencyKey,
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "IDEMPOTENCY_KEY_CONFLICT");
      return true;
    }
  );
});

// 8. Another request has already submitted payment.
test("should return the existing payment when a concurrent request wins", async () => {
  const { service } = createTestService({
    createPaymentSubmission: async () => null,
    findPaymentByIdempotencyKey: async () => payment,
  });

  const result = await service.submitBankTransfer({
    orderId,
    buyerId,
    bankReference,
    idempotencyKey,
  });

  assert.equal(result.data.payment.id, payment.id);
});

// 9. Database reports a duplicate bank reference.
test("should reject a duplicate bank reference reported by the database", async () => {
  const { service } = createTestService({
    createPaymentSubmission: async () => {
      const error = new Error("Unique constraint failed");
      error.code = "P2002";
      throw error;
    },
  });

  await assert.rejects(
    service.submitBankTransfer({
      orderId,
      buyerId,
      bankReference,
      idempotencyKey,
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "DUPLICATE_BANK_REFERENCE");
      return true;
    }
  );
});