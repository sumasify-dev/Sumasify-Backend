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

---

# Address API (supporting checkout)

The contract requires `addressid` at checkout but defines no address creation
flow, so these buyer-scoped supporting endpoints are provided.

Requires `BUYER` authorization.

## List addresses

```http
GET /api/v1/addresses
```

## Create address

```http
POST /api/v1/addresses
```

```json
{
  "label": "Home",
  "recipientname": "Ada Obi",
  "phone": "08012345678",
  "areacode": "400001",
  "addressline": "12 University Road",
  "instructions": "Call on arrival",
  "isdefault": true
}
```

The first address automatically becomes the default. Setting `isdefault: true`
atomically clears the previous default.

---

# Checkout API

Requires `BUYER` authorization.

## Preview checkout

```http
POST /api/v1/checkout/preview
```

```json
{
  "addressid": "uuid",
  "deliverypreferences": {
    "vendor-uuid": { "method": "DELIVERY" }
  }
}
```

All prices, delivery fees, commission and totals are recalculated from the
database. A delivery preference is required for every vendor in the cart.

## Create order

```http
POST /api/v1/checkout/orders
Idempotency-Key: <unique-client-generated-key>
```

```json
{
  "addressid": "uuid",
  "deliverypreferences": {
    "vendor-uuid": { "method": "DELIVERY" }
  },
  "paymentmethod": "BANK_TRANSFER"
}
```

Order creation runs in a single transaction: stock is rechecked and reserved,
the parent order, vendor groups, item snapshots, pending payment and stock
reservations are created, and the cart is cleared. Reusing an idempotency key
returns the original result; reusing it with a different payload returns
`409 IDEMPOTENCY_KEY_CONFLICT`.

V1 commerce settings (`COMMISSION_RATE_BPS`, `DELIVERY_FEE_AMOUNT`,
`STOCK_RESERVATION_MINUTES`, platform bank details) are documented in
`PRD_UNCOMPLETED_MODULES.md` §4.1 and configured through environment variables.

---

# Admin Payment Verification

Requires `ADMIN` authorization.

```http
PATCH /api/v1/admin/payments/:paymentid
```

Verify:

```json
{
  "decision": "VERIFIED"
}
```

Reject:

```json
{
  "decision": "rejected",
  "rejectionreason": "Transfer could not be reconciled."
}
```

A decision is only allowed once, and only for a `SUBMITTED` payment.
Verification marks the payment `VERIFIED`, the parent order `PAID`, moves
`PENDING_PAYMENT` vendor groups to `NEW`, and commits reserved stock. Rejection
marks the payment and order rejected and releases reserved stock. Each decision
writes an `AdminAuditLog` in the same transaction.

---

# Vendor Applications and Profile

Requires `BUYER` authorization.

## Submit application

```http
POST /api/v1/vendor-applications
```

```json
{
  "businessname": "Kemi's Store",
  "contactphone": "+2348012345678",
  "description": "Fashion and accessories store",
  "categorynotes": "Fashion"
}
```

Only one `PENDING` application is allowed per buyer. A rejected buyer may
re-apply.

## View own application

```http
GET /api/v1/vendor-applications/me
```

Returns the latest application, or `{ "data": null }` when none exists.

## Vendor profile

Requires `VENDOR` authorization and an `ACTIVE` vendor record.

```http
GET   /api/v1/vendor/profile
PATCH /api/v1/vendor/profile
```

Editable fields: `businessname`, `contactphone`, `pickupaddress`,
`deliverynotes`. Ownership, approval state, status and slug are not
client-controlled.

---

# Admin Vendor Applications

Requires `ADMIN` authorization.

```http
GET   /api/v1/admin/vendor-applications?status=pending&page=1&pagesize=20
PATCH /api/v1/admin/vendor-applications/:id
```

Approve or reject:

```json
{ "decision": "approved" }
```

```json
{ "decision": "rejected", "rejectionreason": "Insufficient business information." }
```

Approval atomically creates or reactivates the vendor record, promotes the user
to `VENDOR`, finalises the application and writes an `AdminAuditLog`. Decisions
are only valid while the application is `pending`.

---

# Vendor Products and Inventory

Requires `VENDOR` authorization and an `ACTIVE` vendor record.

```http
GET   /api/v1/vendor/products?status=active&page=1&pagesize=20
POST  /api/v1/vendor/products
PATCH /api/v1/vendor/products/:productid
PATCH /api/v1/vendor/products/:productid/inventory
```

Create a product:

```json
{
  "name": "Vintage Denim",
  "description": "Classic denim jacket",
  "priceamount": "20000.00",
  "categoryid": "uuid",
  "stockonhand": 10,
  "imageids": ["upload-uuid"]
}
```

The server owns the vendor id, `ACTIVE` status, availability, `publishedAt` and
stock validation. `imageids` must reference unused uploads owned by the same
vendor. `PATCH` accepts `name`, `description`, `priceamount`, `categoryid` and
additional `imageids` (maximum 5 images per product).

Inventory updates cannot drop `stockonhand` below `stockreserved`:

```json
{
  "stockonhand": 25
}
```

Response:

```json
{
  "data": {
    "productid": "uuid",
    "stockonhand": 25,
    "stockreserved": 3,
    "availablestock": 22
  }
}
```

---

# Product Image Uploads

Requires `VENDOR` authorization and an `ACTIVE` vendor record.

```http
POST /api/v1/uploads/product-images
Content-Type: multipart/form-data
```

Use the file field `image` (or `file`). JPEG, PNG and WebP only, maximum 5 MB.
Images are stored in Cloudinary; only metadata is persisted in PostgreSQL.

```json
{
  "data": {
    "uploadid": "uuid",
    "url": "https://...",
    "storagekey": "...",
    "contenttype": "image/jpeg",
    "width": 1200,
    "height": 1200,
    "bytes": 240000
  }
}
```

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`;
optionally override `CLOUDINARY_PRODUCT_FOLDER` (default
`sumasify/products`).

---

# Vendor Orders and Fulfilment

Requires `VENDOR` authorization and an `ACTIVE` vendor record.

```http
GET   /api/v1/vendor/orders?status=NEW&page=1&pagesize=20
GET   /api/v1/vendor/orders/:groupid
PATCH /api/v1/vendor/orders/:groupid/status
```

Vendors only see their own vendor order groups. Status updates must follow the
approved lifecycle one step at a time:

```text
PENDING_PAYMENT → NEW → CONFIRMED → READY → OUT_FOR_DELIVERY → DELIVERED → COMPLETED
```

```json
{
  "status": "READY",
  "vendornotes": "Order packed and ready for pickup."
}
```

A vendor can never advance a `PENDING_PAYMENT` group, verify payment, or settle
their own orders. Reaching `DELIVERED` marks the group
`ELIGIBLE_AFTER_DELIVERY`; the parent order moves to `IN_FULFILMENT` while any
group is active and to `COMPLETED` once every group is finished.
