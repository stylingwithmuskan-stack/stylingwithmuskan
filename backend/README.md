# Styling with Muskan – Backend API

Base URL: `http://localhost:5000`

## Auth
- Route: POST `/auth/request-otp`
  - Req: `{ "phone": "string(10)" }`
  - Res: `200 { "success": true, "message": "OTP sent" }`
- Route: POST `/auth/verify-otp`
  - Req: `{ "phone": "string(10)", "otp": "string(4-6)" }`
  - Res: `200 { "token": "jwt", "user": { ... } }`
- Route: POST `/auth/logout`
  - Req: none
  - Res: `200 { "success": true }`
- Route: GET `/auth/me`
  - Req: Header `Authorization: Bearer <jwt>` or cookie
  - Res: `200 { "user": { ... } }`

## Users
- Route: GET `/users/me`
  - Req: auth
  - Res: `200 { "user": { ... } }`
- Route: PATCH `/users/me`
  - Req: `{ "name"?: "string", "referralCode"?: "string" }`
  - Res: `200 { "success": true, "user": { ... } }`
- Route: GET `/users/me/addresses`
  - Req: auth
  - Res: `200 { "addresses": [ ... ] }`
- Route: POST `/users/me/addresses`
  - Req: `{ "houseNo": "string", "area": "string", "landmark"?: "string", "type"?: "home|work|other", "lat"?: number, "lng"?: number }`
  - Res: `201 { "address": { ... }, "addresses": [ ... ] }`
- Route: DELETE `/users/me/addresses/:id`
  - Req: path `id`
  - Res: `200 { "addresses": [ ... ] }`

## Content
- Route: GET `/content/service-types`
  - Res: `200 { "data": [ ... ] }`
- Route: GET `/content/booking-types`
  - Res: `200 { "data": [ ... ] }`
- Route: GET `/content/categories?gender=women|men`
  - Res: `200 { "data": [ ... ] }`
- Route: GET `/content/services?category=...&gender=...`
  - Res: `200 { "data": [ ... ] }`
- Route: GET `/content/banners?gender=women|men`
  - Res: `200 { "data": { women: [], men: [] } }`
- Route: GET `/content/providers`
  - Res: `200 { "data": [ ... ] }`
- Route: GET `/content/office-settings`
  - Res: `200 { "data": { startTime, endTime, autoAssign, notificationMessage } }`

## Bookings
- Route: GET `/bookings?page=1&limit=20`
  - Req: auth
  - Res: `200 { "bookings": [ ... ], "page": 1, "limit": 20, "total": 0 }`
- Route: POST `/bookings/quote`
  - Req: `{ "items": [ { "name": "string", "price": number, "quantity": number, "duration": "string", "category": "string", "serviceType": "string" } ], "couponCode"?: "string" }`
  - Res: `200 { "total": number, "discount": number, "finalTotal": number, "couponApplied": "string|null" }`
- Route: POST `/bookings`
  - Req: `{ "items": [...], "slot": { "date": "string", "time": "string" }, "address": { "houseNo": "string", "area": "string", "landmark"?: "string", "lat"?: number, "lng"?: number }, "bookingType": "instant|scheduled", "couponCode"?: "string" }`
  - Res: `201 { "booking": { ... }, "totals": { ... }, "advanceAmount": number, "order"?: { "id": "string", ... } }`
- Route: GET `/bookings/:id`
  - Req: path `id`
  - Res: `200 { "booking": { ... } }`

## Payments
- Route: POST `/payments/razorpay/order`
  - Req: `{ "amount": integer, "currency"?: "string", "receipt"?: "string" }`
  - Res: `200 { "order": { ... } }`
- Route: POST `/payments/razorpay/verify`
  - Req: `{ "order_id": "string", "payment_id": "string", "signature": "string", "bookingId"?: "string", "amount"?: integer }`
  - Res: `200 { "success": true }`

## Provider
- Route: POST `/provider/request-otp`
  - Req: `{ "phone": "string(10)" }`
  - Res: `200 { "success": true }`
- Route: POST `/provider/verify-otp`
  - Req: `{ "phone": "string(10)", "otp": "string(4-6)" }`
  - Res: `200 { "provider": { ... } }`
- Route: PATCH `/provider/bookings/:id/status`
  - Req: `{ "status": "string" }`
  - Res: `200 { "booking": { ... } }`
- Route: POST `/provider/bookings/:id/verify-otp`
  - Req: `{ "otp": "string(4)" }`
  - Res: `200 { "booking": { ... } }`
- Route: PATCH `/provider/me/location`
  - Req: `{ "lat": number, "lng": number }`
  - Res: `200 { "provider": { ... } }`

## Admin
- Route: POST `/admin/login`
  - Req: `{ "email": "string", "password": "string" }`
  - Res: `200 { "admin": { ... } }`
- Route: PUT `/admin/settings`
  - Req: `{ "startTime": "HH:mm", "endTime": "HH:mm", "autoAssign": boolean }`
  - Res: `200 { "settings": { ... } }`

## Docs
- Swagger UI: GET `/docs`
