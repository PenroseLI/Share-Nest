# Guía de Descarga — Main (Proyecto Completo)

> **Todo está en `main`** — antes se separó por ramas por didáctica, ahora todo está aquí unificado y bien explicado. **Diagrama BD:** [`docs/diagrama-bd.drawio`](./docs/diagrama-bd.drawio)

## Requisitos

Node 20+, npm 10+, Git, Postman opcional.

## 1. Clonar (main)

```bash
git clone https://github.com/cdtello/backend-nestjs-seed.git
cd backend-nestjs-seed
```

## 2. Instalar y arrancar

```bash
npm install
cp .env.example .env
cat .env  # DB_TYPE=sqlite crea data/app.sqlite solo
npm run start:dev
# Nest application successfully started → http://localhost:3000
```

Otros: `npm run build`, `npm run start:prod`, `npm run lint`, `npm run format`. Para resetear BD: `rm data/app.sqlite` y reiniciar.

## 3. Probar Users (base)

```bash
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" \
  -d '{"id":"1234567890","name":"Ana","email":"ana@seed.local","age":25,"phone":"+573001234567"}'
curl http://localhost:3000/users
curl http://localhost:3000/users/1234567890
curl -X PUT http://localhost:3000/users/1234567890 -H "Content-Type: application/json" -d '{"age":26}'
curl -X DELETE http://localhost:3000/users/1234567890  # soft
```

Postman → carpeta **Users** (5 requests).

## 4. Probar Products (standalone + filtros)

**Cómo funciona (ver código):**
- `src/products/dto/filter-product.dto.ts` — DTO con `@IsOptional()` + `@Type(()=>Number)`
- `src/products/controllers/products.controller.ts` — `@Get() findAll(@Query() filter: FilterProductDto)`
- `src/products/services/products.service.ts` — `QueryBuilder` con `where isActive` + `andWhere` para `name` (`LOWER LIKE`), `price` y `stock`

```bash
curl -X POST http://localhost:3000/products -H "Content-Type: application/json" \
  -d '{"name":"Proteína Whey","price":129.9,"stock":50}'

curl http://localhost:3000/products
curl "http://localhost:3000/products?name=whey"  # case-insensitive
curl "http://localhost:3000/products?minPrice=50&maxPrice=200"
curl "http://localhost:3000/products?minStock=10"
curl "http://localhost:3000/products?name=prote&minPrice=50&maxStock=100"
```

Postman → carpeta **Products** (8 requests, 3 de filtros).

## 5. Probar Orders (tienda con relaciones + transacción)

**Diagrama:** `User 1—N Order 1—N OrderItem N—1 Product` (ver `docs/diagrama-bd.drawio` y `src/orders/entities/` con comentarios al final).

**Cómo funciona `POST /orders` (`src/orders/services/orders.service.ts`):**
1. `QueryRunner.startTransaction()`
2. Valida `User` activo, cada `Product` activo y `stock >= quantity`
3. `total += price*quantity`, `stock -= quantity`
4. `create(Order)` con `items` + `save` (cascade) → `commit` o `rollback`

```bash
# Necesitas userId y productId previos
curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" \
  -d '{"userId":"1234567890","items":[{"productId":"<uuid>","quantity":2}]}'
# → 201 { id, total, status:PENDING, items:[{quantity, unitPrice, product}] }

curl http://localhost:3000/orders
curl http://localhost:3000/orders/<orderId>
curl http://localhost:3000/orders/user/1234567890
curl -X PUT http://localhost:3000/orders/<orderId> -H "Content-Type: application/json" -d '{"status":"PAID"}'
curl -X PUT http://localhost:3000/orders/<orderId>/cancel  # restaura stock
```

**Filtros Orders** (`src/orders/dto/filter-order.dto.ts` + `QueryBuilder`):

```bash
curl "http://localhost:3000/orders?status=PENDING"
curl "http://localhost:3000/orders?userId=1234567890"
curl "http://localhost:3000/orders?status=PENDING&userId=1234567890"
```

Postman → carpeta **Orders** (11 requests).

## 6. Estructura Final

```
src/
  main.ts / app.module.ts / config/env.validation.ts
  users/    # CRUD Users
  products/ # CRUD Products + filtros
  orders/   # Orders + OrderItem con relaciones + filtros
postman/backend-nestjs-seed.postman_collection.json
docs/diagrama-bd.drawio
```

## 7. Verificación

```bash
npm run build && npm run lint && npm run start:dev
# Probar en Postman las 3 carpetas. Si todo da 201/200 y filtros funcionan, está OK.
```
