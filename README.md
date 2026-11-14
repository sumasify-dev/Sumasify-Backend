# Categories API

```text
Fashion
Electronics/Gadgets
Beauty
Accessories
Books/Textbooks
Services
Other
```

---

## List public categories

```http
GET /api/v1/categories
```

Returns active categories for public catalogue use.

Example:

```http
GET /api/v1/categories
```

---

# Admin Category API

These endpoints require:

```text
ADMIN
```

authorization.

## Create category

```http
POST /api/v1/admin/categories
```

Example:

```json
{
  "name": "Fashion"
}
```

The backend derives the category slug and prevents duplicate categories.

---

## Update category

```http
PATCH /api/v1/admin/categories/:categoryId
```

Example:

```http
PATCH /api/v1/admin/categories/7c8...
```

Request:

```json
{
  "name": "Fashion & Clothing"
}
```

The backend validates the category and handles slug updates appropriately.

---

## Change category status

```http
PATCH /api/v1/admin/categories/:categoryId/status
```

Example:

```json
{
  "isActive": false
}
```

This allows an administrator to activate/deactivate a category without deleting it.

---

# Product Catalogue API

The catalogue supports:

- Search
- Category filtering
- Vendor filtering
- Minimum price
- Maximum price
- Stock filtering
- Sorting
- Pagination
- Product detail retrieval

---

# 10. List Products

```http
GET /api/v1/products
```

### Supported query parameters

| Parameter  | Description                         |
| ---------- | ----------------------------------- |
| `q`        | Search product name/description     |
| `category` | Category UUID or slug               |
| `vendor`   | Vendor UUID                         |
| `minPrice` | Minimum price                       |
| `maxPrice` | Maximum price                       |
| `inStock`  | Filter by current availability      |
| `sort`     | `newest`, `price_asc`, `price_desc` |
| `page`     | Page number                         |
| `pageSize` | Number of records per page          |

`pageSize` is capped at:

```text
50
```

---

## Example — basic catalogue request

```http
GET /api/v1/products
```

## Example — search

```http
GET /api/v1/products?q=iphone
```

## Example — category

```http
GET /api/v1/products?category=fashion
```

## Example — price range

```http
GET /api/v1/products?minPrice=5000&maxPrice=50000
```

## Example — only products currently in stock

```http
GET /api/v1/products?inStock=true
```

## Example — cheapest first

```http
GET /api/v1/products?sort=price_asc
```

## Example — newest products

```http
GET /api/v1/products?sort=newest
```

## Example — pagination

```http
GET /api/v1/products?page=1&pageSize=20
```

---

# Product List Response

The product DTO follows the contract's catalogue structure.

Example:

```json
{
  "data": [
    {
      "id": "product-id",
      "name": "Sample Product",
      "description": "Product description",
      "price": {
        "amount": "25000.00",
        "currency": "NGN"
      },
      "category": {
        "id": "category-id",
        "name": "Fashion",
        "slug": "fashion"
      },
      "availability": "IN_STOCK",
      "stockQuantity": 12,
      "images": [],
      "vendor": {
        "id": "vendor-id",
        "name": "Vendor Name"
      }
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

Money is represented as decimal strings rather than JavaScript floating-point numbers.

For example:

```json
{
  "amount": "25000.00",
  "currency": "NGN"
}
```

---

# Product Availability

The backend calculates the available stock rather than simply exposing raw inventory.

Conceptually:

```text
available stock =
stockOnHand - stockReserved
```

This means a product can have inventory in the database while still being unavailable for purchase because part of that inventory is reserved.

---

# Public Product Visibility

The public catalogue does not simply return every product stored in the database.

A product must satisfy the backend's publication/visibility requirements.

The implemented catalogue checks the relevant product, category and vendor state.

In particular, public catalogue visibility requires the relevant entities to be active/available according to the contract rules.

This prevents inactive catalogue records from accidentally appearing to buyers.

---

# Get Product Details

```http
GET /api/v1/products/:productId
```

Example:

```http
GET /api/v1/products/7c8e9...
```

Response:

```json
{
  "data": {
    "id": "product-id",
    "name": "Sample Product",
    "description": "Product description",
    "price": {
      "amount": "25000.00",
      "currency": "NGN"
    },
    "category": {
      "id": "category-id",
      "name": "Fashion",
      "slug": "fashion"
    },
    "availability": "IN_STOCK",
    "stockQuantity": 12,
    "images": [],
    "vendor": {
      "id": "vendor-id",
      "name": "Vendor Name"
    }
  }
}
```

---

# Pagination

Catalogue endpoints use:

```text
page
pageSize
```

Example:

```http
GET /api/v1/products?page=2&pageSize=10
```

The response includes pagination metadata.

```json
{
  "meta": {
    "page": 2,
    "pageSize": 10,
    "total": 47,
    "totalPages": 5
  }
}
```

The maximum page size is:

```text
50
```

---

# Cart API

The cart is buyer-specific and server-backed.

Requires:

```text
BUYER
```

authorization.

## Get buyer cart

```http
GET /api/v1/cart
```

Returns the current cart, item details, subtotal, and any stock/availability notices.

Example response:

```json
{
  "data": {
    "id": "cart-id",
    "items": [
      {
        "product": {
          "id": "product-id",
          "name": "Vintage Denim"
        },
        "quantity": 2,
        "unitPrice": {
          "amount": "20000.00",
          "currency": "NGN"
        },
        "availability": "IN_STOCK"
      }
    ],
    "subtotal": {
      "amount": "40000.00",
      "currency": "NGN"
    },
    "notices": []
  }
}
```

> Cart totals are display-only. Final pricing is recalculated at checkout.

---

## Add or update cart item

```http
PUT /api/v1/cart/items/:productid
```

Request body:

```json
{
  "quantity": 2
}
```

Returns the updated cart after the item quantity is set.

---

## Remove cart item

```http
DELETE /api/v1/cart/items/:productid
```

Removes the product from the buyer's cart.

Successful response:

```http
204 No Content
```

# Checkout Module

The checkout module allows authenticated buyers to preview their purchases and create orders containing products from one or multiple vendors.

## Checkout Features

- Checkout preview.
- Multi-vendor order creation.
- Vendor-specific delivery preferences.
- Vendor-managed delivery.
- Optional pickup.
- Server-side price and total calculations.
- 5% platform commission.
- Atomic stock reservation.
- Idempotent order creation.
- Bank transfer payment method.
- 15-minute payment expiry.
- Stock release for eligible expired orders.

## Checkout Business Rules

1. The server calculates all product prices and checkout totals. Clients must not submit their own prices, commission, delivery charges or order totals.

2. The platform commission is 5% of the product subtotal only. Delivery charges are excluded from commission calculations.

3. Delivery is managed by individual vendors.

4. Buyers select either `DELIVERY` or `PICKUP` for each vendor in their cart.

5. Delivery fees are configured by vendors through the `deliveryFeeAmount` field.

6. Pickup orders have no delivery charge and require a configured vendor pickup address.

7. Checkout supports `BANK_TRANSFER`.

8. Each order requires an `Idempotency-Key` header to prevent duplicate orders when a buyer retries a request.

9. Stock is reserved atomically when an order is created.

10. Payment expires 15 minutes after order creation if it remains awaiting submission.

11. Expired, cancelled or rejected orders must release their stock reservations safely.

12. Stock reservations must not be released for payments that have already been verified.

13. Payment verification is performed separately by an administrator.

## Vendor Delivery Fee Configuration

Add the following field to the existing Prisma `Vendor` model:

```prisma
deliveryFeeAmount Decimal @default(0) @map("delivery_fee_amount") @db.Decimal(12, 2)
```

Apply the migration:

```bash
npx prisma migrate dev --name add_vendor_delivery_fee
```

Regenerate the Prisma client:

```bash
npx prisma generate
```

Do not add the same field twice if the migration has already been applied.

## Checkout Endpoints

### 1. Preview Checkout

**Endpoint**

```http
POST /api/v1/checkout/preview
```

**Headers**

```http
Authorization: Bearer YOUR_BUYER_ACCESS_TOKEN
Content-Type: application/json
```

**Request Body**

```json
{
  "addressId": "ADDRESS_UUID",
  "deliveryPreferences": {
    "VENDOR_UUID": {
      "method": "DELIVERY"
    }
  }
}
```

Supported delivery methods:

- `DELIVERY`
- `PICKUP`

The endpoint calculates the checkout subtotal, delivery amount, total amount and vendor groups without creating an order or reserving stock.

### 2. Create Checkout Order

**Endpoint**

```http
POST /api/v1/checkout/orders
```

**Headers**

```http
Authorization: Bearer YOUR_BUYER_ACCESS_TOKEN
Content-Type: application/json
Idempotency-Key: checkout-unique-key-001
```

**Request Body**

```json
{
  "addressId": "ADDRESS_UUID",
  "deliveryPreferences": {
    "VENDOR_UUID": {
      "method": "DELIVERY"
    }
  },
  "paymentMethod": "BANK_TRANSFER"
}
```

A successful request creates:

- Parent order.
- Vendor order groups.
- Order items.
- Payment record.
- Stock reservations.

All order creation and stock reservation operations are performed inside a database transaction.

A new order returns `201 Created`. Repeating a successful request with the same idempotency key for the same buyer returns the existing order.

## Payment Instructions

The platform's business bank account details are configured using:

```env
SUMASIFY_BANK_NAME=
SUMASIFY_ACCOUNT_NAME=
SUMASIFY_ACCOUNT_NUMBER=
```

The order number is used as the bank transfer payment reference.

Bank details should only be provided to buyers through the platform's payment instructions.

## Stock Reservation and Payment Expiry

Stock is reserved when checkout order creation succeeds.

Each stock reservation has an expiry time of 15 minutes after order creation.

The payment expiry process should:

1. Identify expired pending payments.
2. Confirm that the payment has not been submitted or verified.
3. Mark the payment as expired.
4. Mark the order as expired.
5. Release the associated stock reservations.
6. Update the product's reserved stock quantity.

These operations must be performed safely and transactionally to prevent incorrect stock releases.

## Postman Testing

Use a valid buyer access token and IDs from your development database.

### Test 1: Checkout Preview

```http
POST /api/v1/checkout/preview
```

Verify that the response contains:

- Product subtotal.
- Delivery amount.
- Total amount.
- Vendor groups.
- Product information.

### Test 2: Create Order

```http
POST /api/v1/checkout/orders
```

Verify that:

- An order is created.
- Vendor order groups are created.
- Order items are created.
- A payment record is created.
- Stock is reserved.
- The response contains payment instructions.

### Test 3: Idempotency

Send the same order request twice with the same `Idempotency-Key`.

Expected result:

- The first request creates the order.
- The second request returns the existing order.
- No duplicate order is created.

### Test 4: Invalid Address

Attempt checkout using an address that does not belong to the authenticated buyer.

Expected result:

```text
INVALID_ADDRESS
```

### Test 5: Empty Cart

Attempt checkout with an empty cart.

Expected result:

```text
EMPTY_CART
```

### Test 6: Insufficient Stock

Attempt checkout when the requested product quantity exceeds available stock.

Expected result:

```text
INSUFFICIENT_STOCK
```

No partial stock reservation should remain.

### Test 7: Pickup

Select `PICKUP` as the delivery method.

Expected result:

- Delivery amount is zero for that vendor.
- Vendor pickup address is available.

### Test 8: Payment Expiry

In a development environment, test an order whose payment has passed its expiry time.

Expected result:

- Payment status becomes `EXPIRED`.
- Order status becomes `EXPIRED`.
- Stock reservations are released.
- Product reserved stock is reduced.

Do not perform expiry tests against real customer orders.
