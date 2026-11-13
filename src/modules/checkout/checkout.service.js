import { createHash } from "node:crypto";

import { commerceConfig } from "../../config/commerce.js";
import { AppError } from "../../middleware/utils/AppError.js";
import {
  findCartForCheckout,
  findAddressForCheckout,
  findCheckoutByIdempotencyKey,
  createCheckoutTransaction,
} from "./checkout.model.js";
import {
  buildCheckoutPricing,
  formatMoney,
} from "./checkout.pricing.js";

function normalizedDeliveryPreferences(deliveryPreferences) {
  return Object.entries(deliveryPreferences ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([vendorId, preference]) => ({
      vendorid: vendorId,
      method:
        typeof preference?.method === "string"
          ? preference.method.toUpperCase()
          : null,
    }));
}

export function hashCheckoutRequest({
  addressid,
  deliverypreferences,
  paymentmethod,
}) {
  const canonicalPayload = JSON.stringify({
    addressid,
    deliverypreferences: normalizedDeliveryPreferences(
      deliverypreferences,
    ),
    paymentmethod,
  });

  return createHash("sha256").update(canonicalPayload).digest("hex");
}

function buildAddressSnapshot(address) {
  return {
    addressid: address.id,
    label: address.label,
    recipientname: address.recipientName,
    phone: address.phone,
    areacode: address.areaCode,
    addressline: address.addressLine,
    instructions: address.instructions,
  };
}

function formatPreview({ pricing }) {
  return {
    data: {
      currency: pricing.currency,
      subtotalamount: formatMoney(pricing.subtotalAmount),
      deliveryamount: formatMoney(pricing.deliveryAmount),
      totalamount: formatMoney(pricing.totalAmount),
      vendorgroups: pricing.groups.map((group) => ({
        vendor: {
          id: group.vendor.id,
          businessname: group.vendor.businessname,
        },
        items: group.items.map((item) => ({
          productid: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitpriceamount: formatMoney(item.unitPrice),
          linetotalamount: formatMoney(item.lineTotal),
        })),
        subtotalamount: formatMoney(group.subtotalAmount),
        deliveryamount: formatMoney(group.deliveryAmount),
        deliverymethod: group.deliverymethod,
      })),
      warnings: pricing.warnings,
    },
  };
}

function formatVendorGroup(group) {
  return {
    id: group.id,
    groupnumber: group.groupNumber,
    vendor: {
      id: group.vendor.id,
      businessname: group.vendor.businessName,
    },
    subtotalamount: formatMoney(group.subtotalAmount),
    deliveryamount: formatMoney(group.deliveryAmount),
    commissionamount: formatMoney(group.commissionAmount),
    payoutamount: formatMoney(group.payoutAmount),
    fulfilmentstatus: group.fulfilmentStatus,
    deliverymethod: group.deliveryMethod,
    items: group.orderItems.map((item) => ({
      id: item.id,
      productid: item.productId,
      productname: item.productNameSnapshot,
      unitpriceamount: formatMoney(item.unitPriceAmount),
      quantity: item.quantity,
      linetotalamount: formatMoney(item.lineTotalAmount),
      imageurl: item.imageUrlSnapshot,
      vendorname: item.vendorNameSnapshot,
    })),
  };
}

function formatCheckout({ order, payment, config }) {
  const resolvedPayment = payment ?? order.payments?.[0];

  if (!resolvedPayment) {
    throw new AppError(
      "Payment record missing for order",
      500,
      "PAYMENT_RECORD_MISSING",
    );
  }

  return {
    data: {
      order: {
        id: order.id,
        ordernumber: order.orderNumber,
        status: order.status,
        paymentstatus: order.paymentStatus,
        currency: order.currency,
        subtotalamount: formatMoney(order.subtotalAmount),
        deliveryamount: formatMoney(order.deliveryAmount),
        totalamount: formatMoney(order.totalAmount),
        vendorgroups: order.vendorOrderGroups.map(formatVendorGroup),
      },
      payment: {
        id: resolvedPayment.id,
        method: resolvedPayment.method,
        status: resolvedPayment.status,
        amount: formatMoney(resolvedPayment.amount),
      },
      paymentinstructions: {
        bankname: config.platformBank.bankname,
        accountname: config.platformBank.accountname,
        accountnumber: config.platformBank.accountnumber,
        reference: order.orderNumber,
      },
    },
  };
}

export function createCheckoutService({
  findCartForCheckout,
  findAddressForCheckout,
  findCheckoutByIdempotencyKey,
  createCheckoutTransaction,
  config,
}) {
  async function loadCheckoutInput({
    buyerId,
    addressid,
    deliverypreferences,
  }) {
    const [cart, address] = await Promise.all([
      findCartForCheckout(buyerId),
      findAddressForCheckout({ addressId: addressid, buyerId }),
    ]);

    if (!address) {
      throw new AppError(
        "Address not found",
        400,
        "INVALID_ADDRESS",
      );
    }

    const pricing = buildCheckoutPricing({
      cart,
      deliveryPreferences: deliverypreferences,
      config,
    });

    return { cart, address, pricing };
  }

  function replayExisting({
    existing,
    buyerId,
    requestHash,
  }) {
    if (
      existing.buyerId !== buyerId ||
      existing.requestHash !== requestHash
    ) {
      throw new AppError(
        "Idempotency key has already been used for another checkout",
        409,
        "IDEMPOTENCY_KEY_CONFLICT",
      );
    }

    return formatCheckout({
      order: existing.order,
      config,
    });
  }

  async function previewCheckout({
    buyerId,
    addressid,
    deliverypreferences,
  }) {
    const { pricing } = await loadCheckoutInput({
      buyerId,
      addressid,
      deliverypreferences,
    });

    return formatPreview({ pricing });
  }

  async function createCheckoutOrder({
    buyerId,
    addressid,
    deliverypreferences,
    paymentmethod,
    idempotencykey,
  }) {
    if (paymentmethod !== "BANK_TRANSFER") {
      throw new AppError(
        "Unsupported payment method",
        400,
        "INVALID_PAYMENT_METHOD",
      );
    }

    const requestHash = hashCheckoutRequest({
      addressid,
      deliverypreferences,
      paymentmethod,
    });

    const existing = await findCheckoutByIdempotencyKey(
      idempotencykey,
    );

    if (existing) {
      return replayExisting({
        existing,
        buyerId,
        requestHash,
      });
    }

    const { address, pricing } = await loadCheckoutInput({
      buyerId,
      addressid,
      deliverypreferences,
    });

    let result;

    try {
      result = await createCheckoutTransaction({
        buyerId,
        addressSnapshot: buildAddressSnapshot(address),
        pricing,
        paymentMethod: paymentmethod,
        idempotencyKey: idempotencykey,
        requestHash,
        config,
      });
    } catch (error) {
      // A concurrent request with the same idempotency key may have won
      // the race after our lookup. Replay its committed result.
      if (error?.code === "P2002") {
        const raced = await findCheckoutByIdempotencyKey(
          idempotencykey,
        );

        if (raced) {
          return replayExisting({
            existing: raced,
            buyerId,
            requestHash,
          });
        }

        throw new AppError(
          "Unable to create order at this time",
          503,
          "ORDER_CREATION_FAILED",
        );
      }

      throw error;
    }

    return formatCheckout({
      order: result.order,
      payment: result.payment,
      config,
    });
  }

  return {
    previewCheckout,
    createCheckoutOrder,
  };
}

const checkoutService = createCheckoutService({
  findCartForCheckout,
  findAddressForCheckout,
  findCheckoutByIdempotencyKey,
  createCheckoutTransaction,
  config: commerceConfig,
});

export const { previewCheckout, createCheckoutOrder } =
  checkoutService;