# Sistema de Gestión Interna — Local de Venta de Celulares

Aplicación web de uso interno para gestionar inventario, ventas, stock, cuotas,
usuarios y auditoría de un local de venta de celulares.

El sistema maneja **dos formas de contar stock**, porque el negocio vende dos
tipos de producto muy distintos:

| | Se gestionan así | Ejemplos |
| --- | --- | --- |
| **Equipos** | Unidad individual, cada uno con su ficha | Celulares, tablets, relojes, parlantes, cámaras |
| **Accesorios** | Por cantidad, un registro con stock | Fundas, templados, protectores, cargadores, cables |

Un iPhone 13 y otro iPhone 13 son **dos registros distintos**, cada uno con su
IMEI, su porcentaje de batería, su precio y su historia. En cambio, treinta
fundas iguales son **un registro con stock 30**, que sube y baja.

---

## Índice

1. [Requisitos](#requisitos)
2. [Puesta en marcha en 5 pasos](#puesta-en-marcha-en-5-pasos)
3. [Usuarios y contraseñas](#usuarios-y-contraseñas)
4. [Roles: qué puede hacer cada uno](#roles-qué-puede-hacer-cada-uno)
5. [Cómo se usa el sistema](#cómo-se-usa-el-sistema)
6. [Cuotas y financiación](#cuotas-y-financiación)
7. [Variables de entorno](#variables-de-entorno)
8. [Todos los comandos](#todos-los-comandos)
9. [Despliegue en Vercel](#despliegue-en-vercel)
10. [Crear el primer administrador en producción](#crear-el-primer-administrador-en-producción)
11. [Arquitectura](#arquitectura)
12. [Reglas de negocio garantizadas](#reglas-de-negocio-garantizadas)
13. [Seguridad](#seguridad)
14. [Tests](#tests)
15. [Problemas frecuentes](#problemas-frecuentes)
16. [Estado del proyecto](#estado-del-proyecto)

---

## Requisitos

| Herramienta | Versión | Para qué |
| --- | --- | --- |
| Node.js | 20 o superior | Ejecutar la aplicación |
| Docker Desktop | cualquiera reciente | Base de datos local |

Si preferís no usar Docker, alcanza con tener un PostgreSQL 14+ accesible y
apuntar `DATABASE_URL` a esa instancia.

---

## Puesta en marcha en 5 pasos

**1. Instalar dependencias**

```bash
npm install
```

**2. Crear el archivo de configuración**

```bash
cp .env.example .env
```

Los valores por defecto ya sirven para desarrollo local. No hace falta editarlo
para empezar.

**3. Levantar la base de datos**

```bash
npm run db:up
```

Esto arranca PostgreSQL en Docker (contenedor `paki-postgres`, puerto 5432).
Docker Desktop tiene que estar abierto.

**4. Crear las tablas y cargar datos de ejemplo**

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

El seed carga 4 usuarios, 40 equipos, 12 ventas, clientes, proveedores y cuotas
en distintos estados (pagas, vencidas y por vencer).

**5. Arrancar la aplicación**

```bash
npm run dev
```

Abrir **http://localhost:3000** e ingresar con cualquiera de los usuarios de la
sección siguiente.

---

## Usuarios y contraseñas

> ⚠️ **Solo para desarrollo.** La contraseña sale de la variable
> `SEED_PASSWORD` del archivo `.env` (por defecto `Demo1234!`).
> El seed se niega a correr en producción salvo que se defina explícitamente
> `ALLOW_PRODUCTION_SEED=1`. **Nunca uses estas credenciales en el local real.**

| Rol | Email | Contraseña | Nombre |
| --- | --- | --- | --- |
| Administrador | `lucia@local.com` | `Demo1234!` | Lucía Fernández |
| Administrador | `martin@local.com` | `Demo1234!` | Martín Gómez |
| Vendedor | `sofia@local.com` | `Demo1234!` | Sofía Ramírez |
| Vendedor | `diego@local.com` | `Demo1234!` | Diego Torres |

Para probar las diferencias entre roles, entrá primero con `lucia@local.com`
(ve todo) y después con `sofia@local.com` (ve una versión reducida).

### Política de contraseñas

Al crear usuarios desde la aplicación, la contraseña debe tener:

- mínimo 8 caracteres,
- al menos una minúscula,
- al menos una mayúscula,
- al menos un número.

Se almacenan hasheadas con bcrypt (coste 12). El sistema nunca guarda ni puede
mostrar una contraseña en texto plano: si un empleado la olvida, un
administrador se la reemplaza.

---

## Roles: qué puede hacer cada uno

### Administrador

Acceso completo. Ve las 12 secciones del menú y puede:

- Ver el dashboard con métricas económicas y el valor del inventario.
- Crear, editar y dar de baja equipos y accesorios.
- Modificar precios de venta y de compra.
- Ver el precio de compra y el margen de cada equipo.
- Registrar y **anular** ventas.
- Ajustar stock manualmente y ver todos los movimientos.
- Cobrar cuotas y **anular** cobros mal registrados.
- Gestionar usuarios: crearlos, editarlos y desactivarlos.
- Consultar la auditoría completa.
- Ver reportes y exportar información.

### Vendedor

Ve 6 secciones: Dashboard, Equipos, Accesorios, Ventas, Cuotas y Clientes.

**Puede:**

- Consultar equipos y accesorios, y buscar por IMEI, marca o modelo.
- Registrar ventas.
- Ver **solo sus propias** ventas.
- Cargar clientes nuevos.
- Ver las cuotas pendientes y registrar cobros en el mostrador.

**No puede:**

- Modificar precios ni ver el precio de compra.
- Crear, editar o dar de baja equipos ni accesorios.
- Ajustar stock manualmente ni ver los movimientos de stock.
- Anular ventas ni anular cobros de cuotas.
- Gestionar usuarios ni ver la auditoría.
- Ver el valor total del inventario ni los montos globales de ventas.

> Los permisos se validan **en el servidor**, no solo escondiendo botones.
> Un vendedor que escriba `/usuarios` a mano en la barra de direcciones es
> rechazado igual.

---

## Cómo se usa el sistema

### Cargar un equipo

`Equipos` → **Registrar equipo**.

Campos obligatorios: modelo, color, capacidad, estado, IMEI y precio de venta.

- El **IMEI no puede repetirse**. Si ya existe, el sistema lo avisa con un
  mensaje claro y no guarda nada.
- Si el estado es **Usado**, el porcentaje de batería es obligatorio.
- Si es **Nuevo sellado**, la batería es opcional.
- Para accesorios u otros productos sin IMEI, desmarcá la casilla
  *"Este producto requiere IMEI"*.

Cada alta genera automáticamente un movimiento de stock de tipo `INGRESO` y
queda registrada en la auditoría.

### Buscar un equipo

El buscador de equipos encuentra por **IMEI completo o parcial**, número de
serie, marca, modelo o color. El botón **Filtros** agrega marca, modelo, estado,
capacidad, rango de precio, batería mínima y rango de fechas de ingreso.

Los filtros quedan en la URL, así que podés guardar o compartir una vista
filtrada.

### Ver el detalle de un equipo

Clic en el nombre del equipo o en el ícono de ojo. Muestra:

- Identificación (IMEI, número de serie, batería, capacidad).
- Información económica (compra, venta y margen — solo administradores).
- **Historial de movimientos**: cada ingreso, venta, ajuste o baja, con usuario
  y fecha.
- **Historial de modificaciones**: qué campo cambió, de qué valor a qué valor y
  quién lo hizo. Por ejemplo: *Precio de venta: 800.000 → 850.000*.
- La venta asociada, si el equipo fue vendido.

### Accesorios

Sección `Accesorios`. Se cargan una vez con su rubro, precio y stock inicial.

- El **stock nunca se edita a mano**. Se mueve con un ajuste (botón `+`), donde
  se indica la cantidad (positiva para ingresar, negativa para descontar) y el
  motivo. Así siempre queda registrado quién lo cambió y por qué.
- El **stock mínimo** dispara la alerta de stock bajo. Poniéndolo en 0 se
  desactiva la alerta para ese producto.
- Los accesorios llevan **solo precio de venta**, sin costo ni margen.
- Al darlos de baja dejan de ofrecerse en las ventas, pero conservan todo su
  historial.

La base impide que el stock quede en negativo, incluso si dos ventas ocurren
al mismo tiempo.

### Registrar una venta

`Ventas` → **Registrar venta**. Una misma venta puede llevar equipos y
accesorios juntos.

Los precios los toma el servidor **de la base de datos**, nunca del navegador:
no se puede manipular el precio desde el cliente. Los descuentos se aplican
sobre el total.

Al confirmar, en una sola transacción: se crea el comprobante, los equipos pasan
a `VENDIDO`, se descuenta el stock de los accesorios, se registran los
movimientos, se generan las cuotas si corresponde y queda todo auditado. Si
algo falla, no queda nada a medias.

### Anular una venta

Solo administradores. La venta **no se elimina**: pasa a `ANULADA` conservando
todo su historial, y se pide un motivo obligatorio.

Al anular: los equipos vuelven a `DISPONIBLE` (salvo que se hayan dado de baja
después, en cuyo caso se respeta esa baja), los accesorios se reintegran al
stock, se crean los movimientos inversos y las cuotas pendientes se anulan. Las
cuotas **ya cobradas se conservan**: registran plata que entró de verdad, y su
devolución se gestiona aparte.

### Compras y proveedores

`Proveedores` guarda a quién le comprás. `Compras` → **Registrar compra**
carga la mercadería recibida: equipos de a uno (cada uno con su IMEI y el precio
con el que entra a la venta) y accesorios por cantidad.

La compra nace en **borrador**: es solo un documento, no toca el inventario.
Al presionar **Confirmar e ingresar stock**, en una sola transacción:

- se crea un equipo en el inventario por cada ítem, con su costo y su precio;
- se suman las unidades al stock de cada accesorio;
- cada ingreso deja su movimiento de stock;
- todo queda auditado.

> **Una compra confirmada no se puede anular.** Su stock ya ingresó y puede
> haberse vendido; revertirlo automáticamente dejaría el inventario
> inconsistente. Para corregirla hay que dar de baja los equipos o ajustar el
> stock de los accesorios, operaciones que quedan registradas por separado.

Los accesorios se reponen eligiéndolos del catálogo: si es un producto nuevo,
primero se crea en la sección Accesorios.

### Reportes y exportación

Sección `Reportes`, con cinco informes:

| Reporte | Qué muestra |
| --- | --- |
| **Inventario actual** | Equipos y accesorios en stock, valorizados a precio de venta |
| **Ventas por período** | Facturación, ticket promedio y apertura por vendedor y método de pago |
| **Movimientos de stock** | Ingresos, ventas, ajustes, devoluciones y bajas |
| **Productos vendidos** | Ranking de lo más vendido, en unidades y facturación |
| **Stock bajo** | Modelos y accesorios por debajo del mínimo |

Filtros según el reporte: rango de fechas, usuario, marca, modelo, estado de
inventario y tipo de movimiento. Las ventas anuladas nunca suman a la
facturación, aunque aparecen en el detalle marcadas como tales.

**Exportación a CSV.** El botón descarga el reporte completo, sin el límite de
200 filas de la vista previa. El archivo está preparado para Excel en español:

- separador **punto y coma**, porque en la configuración regional argentina la
  coma es el separador decimal;
- **BOM** al inicio, sin el cual Excel rompe los acentos y la "ñ";
- decimales con coma, para que Excel los reconozca como números.

> La descarga va por una ruta propia (`/api/reportes`) que **revalida el permiso
> por su cuenta**: es accesible por URL, así que no puede confiar en que el
> botón esté oculto. Un vendedor que la escriba a mano recibe un 403.

### Movimientos de stock

Sección `Movimientos`. El historial completo de todo lo que entró, salió o se
ajustó, con filtros por tipo, usuario, marca y fechas.

Cada fila enlaza al equipo y, cuando corresponde, al comprobante de la venta que
lo originó. Los equipos individuales muestran cantidad 1; los accesorios, la
variación aplicada (`+30`, `−3`).

### Gestionar usuarios

Sección `Usuarios`, exclusiva de administradores.

Al crear un usuario se le asigna una contraseña inicial que debería cambiar la
primera vez que entre (menú de su nombre → **Cambiar mi contraseña**). Si la
olvida, un administrador se la restablece: el sistema **no puede mostrar** una
contraseña, solo reemplazarla.

**Los usuarios nunca se eliminan**, se desactivan. Un usuario desactivado no
puede iniciar sesión, pero sus ventas, altas de productos y movimientos siguen
registrados a su nombre. Se puede reactivar en cualquier momento.

> Si el usuario tenía la sesión abierta cuando lo desactivaste, se le corta en
> la siguiente acción: la sesión se revalida contra la base en cada petición.

**Protecciones contra quedarse afuera del sistema:**

- Nadie puede desactivar su propia cuenta.
- Nadie puede quitarse a sí mismo el rol de administrador.
- No se puede dejar el sistema sin ningún administrador activo.
- Cuando queda un solo administrador, la pantalla avisa para que designes otro.

### Dar de baja un equipo

Ícono de prohibido en la fila. **Nunca se elimina físicamente**: el equipo pasa
a estado `INACTIVO` y conserva todo su historial.

Se pide un motivo obligatorio. Si el equipo tiene una venta asociada, el sistema
lo bloquea y exige una confirmación administrativa explícita.

---

## Cuotas y financiación

El sistema distingue **quién financia la venta**, porque solo un caso genera
deuda del cliente con el local:

| Tipo | Quién financia | ¿El cliente le debe al local? | ¿Genera cuotas a reclamar? |
| --- | --- | --- | --- |
| **Contado** | — | No | No |
| **Cuotas con tarjeta** | El banco | No — el banco liquida el total | No |
| **Financiación del local** | El local | **Sí** | **Sí** |

El recordatorio de cuotas reclama **únicamente** las de financiación propia.
Una venta en 12 cuotas con tarjeta no aparece como deuda, porque el local ya
cobró.

### La pantalla de Cuotas

Sección `Cuotas`. Arriba, tres totales:

- **Vencidas** — cuánta plata está sin cobrar y ya pasó su fecha.
- **Vencen en 7 días** — lo que hay que salir a cobrar esta semana.
- **Total por cobrar** — toda la deuda pendiente.

Debajo, la lista con cliente, teléfono, venta, número de cuota (*3 de 6*),
vencimiento, **días de atraso**, monto y estado.

Las pestañas filtran por **Vencidas / Próximas / Pendientes / Pagadas / Todas**.

El dashboard repite el recordatorio arriba de todo, así que apenas entrás ya ves
cuánto hay para cobrar.

### Registrar un cobro

Botón **Registrar cobro** en la fila. El monto viene precargado con el pactado,
pero se puede ajustar si el cliente pagó una cifra distinta. Se elige método de
pago y fecha.

Queda registrado quién tomó el pago. Si se cargó mal, un administrador puede
anularlo indicando el motivo, y la cuota vuelve a quedar pendiente.

### Detalle importante sobre las fechas

El vencimiento de una cuota es un **día del calendario**, no un instante. El
sistema lo evalúa contra la zona horaria del local
(`America/Argentina/Buenos_Aires`), no contra la del servidor.

Esto importa: Vercel corre en UTC, y sin este cuidado una cuota aparecería
vencida un día antes de lo que corresponde. Una cuota que vence **hoy** no está
vencida.

Si el local no está en Argentina, cambiá `BUSINESS_TIME_ZONE` en
[`src/lib/domain/installments.ts`](src/lib/domain/installments.ts).

---

## Variables de entorno

Plantilla completa en [`.env.example`](.env.example).

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Conexión a PostgreSQL. En Vercel, la URL **pooled**. |
| `DIRECT_URL` | Sí | Conexión **directa** sin pooler; la usan las migraciones. En local es igual a `DATABASE_URL`. |
| `AUTH_SECRET` | Sí | Secreto que firma las sesiones. Generar con `npx auth secret`. |
| `SEED_PASSWORD` | Solo desarrollo | Contraseña de los usuarios demo. |
| `TEST_DATABASE_URL` | Solo tests | Base de tests. Por defecto `paki_test`. |
| `ALLOW_PRODUCTION_SEED` | No | Habilita el seed en producción. **No la definas** salvo que sepas exactamente por qué. |

Ningún secreto está en el código ni se expone al navegador. El archivo `.env`
está en `.gitignore` y no debe subirse al repositorio.

---

## Todos los comandos

### Desarrollo

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Levanta la aplicación en http://localhost:3000 |
| `npm run build` | Compila para producción (incluye `prisma generate`) |
| `npm run start` | Sirve la versión compilada |

### Base de datos

| Comando | Qué hace |
| --- | --- |
| `npm run db:up` | Arranca PostgreSQL en Docker |
| `npm run db:down` | Detiene PostgreSQL |
| `npm run db:migrate` | Crea y aplica migraciones (desarrollo) |
| `npm run db:deploy` | Aplica migraciones sin crear ninguna (producción) |
| `npm run db:seed` | Carga los datos de ejemplo |
| `npm run db:reset` | **Borra todo**, reaplica migraciones y vuelve a sembrar |
| `npm run db:studio` | Abre un explorador visual de la base |
| `npm run db:generate` | Regenera el cliente de Prisma |

### Calidad

| Comando | Qué hace |
| --- | --- |
| `npm run typecheck` | Verifica los tipos |
| `npm run lint` | Pasa el linter |
| `npm run test` | Corre los tests |
| `npm run test:watch` | Tests en modo interactivo |
| `npm run test:setup` | Prepara la base de tests (`paki_test`) |

---

## Despliegue en Vercel

**1. Crear la base de datos**

Cualquier PostgreSQL administrado sirve: Neon, Vercel Postgres o Supabase.
Necesitás dos cadenas de conexión: la *pooled* y la *directa*.

**2. Subir el repositorio a GitHub e importarlo en Vercel**

Vercel detecta Next.js automáticamente; no hay que tocar la configuración de
build.

**3. Cargar las variables de entorno en Vercel**

En *Settings → Environment Variables*:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | Cadena **pooled** del proveedor |
| `DIRECT_URL` | Cadena **directa**, sin pooler |
| `AUTH_SECRET` | Un secreto nuevo, distinto al de desarrollo |

Para generar el secreto:

```bash
npx auth secret
```

**4. Aplicar las migraciones a la base de producción**

Desde tu máquina, apuntando a la base de producción:

```bash
npx prisma migrate deploy
```

**5. Desplegar**

Vercel compila y publica. El script de build corre `prisma generate` solo.

> **No ejecutes `npm run db:seed` en producción.** Ese comando borra todos los
> datos y carga los usuarios demo.

---

## Crear el primer administrador en producción

La base de producción arranca vacía. Para crear el primer usuario real,
generá el hash de su contraseña:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'LaContraseñaElegida'
```

Insertá el usuario en la base con ese hash (desde `npm run db:studio` apuntando
a producción, o con el cliente SQL de tu proveedor):

```sql
INSERT INTO users ("id", "firstName", "lastName", "email", "passwordHash", "role", "status", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Nombre', 'Apellido', 'email@dellocal.com', '<hash-generado>', 'ADMINISTRADOR', 'ACTIVO', now(), now());
```

Con ese usuario ya podés entrar y crear el resto desde la sección **Usuarios**.

---

## Arquitectura

```
src/
  app/
    (auth)/login/          Pantalla de acceso
    (app)/                 Rutas protegidas (layout con sesión y navegación)
      inventario/          Listado, alta, edición y detalle de equipos
      cuotas/              Recordatorio y cobro de cuotas
    api/auth/              Endpoints de autenticación
  components/
    layout/                Sidebar, header y menú de usuario
    ui/                    Componentes del sistema de diseño
  lib/
    auth/                  Sesión, matriz de permisos y guardas de servidor
    domain/                Reglas de negocio puras (sin base ni sesión)
    services/              Lógica de negocio con acceso a datos
    actions/               Server Actions (validan y delegan en services)
    validations/           Esquemas Zod compartidos cliente/servidor
    db.ts                  Cliente Prisma (singleton)
    errors.ts              Errores de dominio con mensajes para el usuario
  proxy.ts                 Protección de rutas
prisma/
  schema.prisma            Modelo de datos
  migrations/              Migraciones versionadas
  seed.ts                  Datos de ejemplo
tests/                     Tests de lógica de negocio
```

**Principio**: la lógica de negocio vive en `lib/services` y `lib/domain`, nunca
dentro de componentes React. Los componentes muestran datos y disparan acciones.

### El diseño

La interfaz sigue el lenguaje visual de las páginas de producto de Apple:
neutros fríos (`#f5f5f7`, `#1d1d1f`), un único azul de acento (`#0066cc`),
tipografía de peso alto con espaciado negativo, botones tipo píldora y
superficies limpias separadas por líneas finas — adaptado a la densidad que
necesita una herramienta de trabajo con tablas.

Los colores están centralizados como variables CSS en
[`src/app/globals.css`](src/app/globals.css). Cambiando esos tokens cambia toda
la aplicación. Incluye modo oscuro.

---

## Reglas de negocio garantizadas

Estas reglas se validan en la aplicación **y** las impone PostgreSQL. Aunque
alguien modifique la base por fuera del sistema, se siguen cumpliendo:

- El IMEI no puede repetirse.
- El porcentaje de batería está entre 0 y 100.
- Un equipo `USADO` debe declarar batería.
- Los precios y las capacidades nunca son negativos.
- Una venta `ANULADA` debe registrar responsable, fecha y motivo.
- Una cuota `PAGADA` debe registrar cuándo, cuánto y quién la cobró.
- Una cuota que no está pagada no puede conservar datos de cobro.
- Solo las ventas financiadas o con tarjeta declaran cantidad de cuotas.

Además, por diseño:

- **Nada se elimina físicamente.** Ni equipos, ni ventas, ni movimientos de
  stock, ni registros de auditoría. Las bajas son lógicas.
- Un equipo vendido no puede volver a venderse.
- Un equipo vendido no vuelve a `DISPONIBLE` editando el formulario: hay que
  anular la venta, lo que además revierte el stock.
- Toda operación importante queda auditada con usuario, fecha y — cuando aplica —
  valor anterior y nuevo.

---

## Seguridad

- Contraseñas hasheadas con bcrypt (coste 12).
- Sesiones JWT firmadas, con vencimiento de 8 horas.
- **Doble barrera**: `proxy.ts` protege las rutas y cada operación de servidor
  revalida los permisos con `requirePermission`. Ocultar un botón en la interfaz
  no se considera un control de seguridad.
- La sesión se **revalida contra la base en cada petición**: desactivar a un
  usuario o cambiarle el rol tiene efecto inmediato, sin esperar a que venza su
  token.
- El error de login es genérico y el tiempo de respuesta es constante: no revela
  qué emails existen ni si una cuenta está desactivada.
- Los errores internos nunca llegan al usuario; se registran en el servidor y la
  pantalla muestra un mensaje comprensible.
- Las operaciones que tocan varias tablas (venta, cobro, baja) corren en una
  transacción: si algo falla, no queda nada a medias.

---

## Tests

```bash
npm run test:setup
```

```bash
npm run test
```

137 tests que cubren la lógica de negocio crítica:

- Alta de equipos, con movimiento de stock y auditoría.
- IMEI único, incluida la reversión completa de la transacción fallida.
- Constraints de la base (batería obligatoria en usados, rango 0-100).
- Auditoría de cambios de precio, con valor anterior y nuevo.
- Baja lógica y bloqueo de baja de equipos vendidos.
- Búsqueda por IMEI exacto y parcial, y filtros.
- Matriz de permisos completa de ambos roles.
- Cálculo del plan de cuotas, incluido el redondeo sin pérdida de centavos.
- Vencimientos evaluados en la zona horaria del local.
- Venta de un equipo disponible e intento de vender uno ya vendido.
- Que el precio lo ponga el servidor y no el cliente.
- Anulación de venta con devolución de equipos y accesorios al stock.
- Que un vendedor no pueda anular ventas ni abrir las de otro.
- Venta de accesorios por cantidad, sin permitir vender más de lo que hay.
- Venta mixta de equipo + accesorios revirtiendo todo si algo falla.
- Contraseñas hasheadas, nunca guardadas ni auditadas en texto plano.
- Que nadie pueda desactivarse a sí mismo ni dejar el sistema sin administradores.
- Que desactivar un usuario conserve todo su historial de operaciones.
- Reportes: valorización del inventario y exclusión de ventas anuladas.
- Que el filtro "hasta" incluya el día completo.
- Generación de CSV: BOM, separador, escapes y decimales para Excel en español.
- Que confirmar una compra ingrese equipos y accesorios al inventario.
- Que una compra fallida no deje stock a medias, ni siquiera parcialmente.
- Que una compra confirmada no pueda anularse.

Los tests corren contra `paki_test`, **nunca** contra la base de desarrollo:
hay una verificación explícita que aborta si la URL no apunta a una base de test.

---

## Problemas frecuentes

**`npm run db:up` falla**
Docker Desktop no está corriendo. Abrilo y esperá a que arranque del todo.

**`Can't reach database server`**
La base no está levantada. Corré `npm run db:up`.

**`Timed out trying to acquire a postgres advisory lock`**
Quedó una conexión colgada de una migración interrumpida:

```bash
docker exec paki-postgres psql -U postgres -d paki -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='paki' AND pid <> pg_backend_pid();"
```

**Después de un `db:seed` la aplicación tira error al guardar**
El seed recrea los usuarios con IDs nuevos y tu sesión quedó apuntando a uno
viejo. Cerrá sesión y volvé a entrar.

**Quiero empezar de cero**

```bash
npm run db:reset
```

---

## Estado del proyecto

| Etapa | Estado |
| --- | --- |
| 1 — Análisis y definición del stack | ✅ Completa |
| 2 — Modelo de datos, migraciones e índices | ✅ Completa |
| 3 — Autenticación, roles y protección de rutas | ✅ Completa |
| 4 — Inventario | ✅ Completa |
| Cuotas y financiación | ✅ Completa |
| Accesorios (stock por cantidad) | ✅ Completa |
| 6 — Ventas, clientes y anulaciones | ✅ Completa |
| 7 — Usuarios y contraseñas | ✅ Completa |
| 8 — Dashboard y reportes | ✅ Completa |
| 5 — Movimientos de stock | ✅ Completa |
| Compras y proveedores | ✅ Completa |
| 9 — UX/UI | 🔶 Base lista; falta pulido final |
| 10 — Testing y producción | 🔶 137 tests; falta cobertura de auditoría |

Quedan sin pantalla **Auditoría** y **Configuración**. La base de datos, los
permisos y los servicios que las sostienen ya están construidos: la auditoría,
por ejemplo, se viene registrando desde la primera etapa y ya se consulta desde
la ficha de cada equipo.

---

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 |
| Lenguaje | TypeScript estricto |
| Estilos | Tailwind CSS v4 |
| Base de datos | PostgreSQL 16 |
| ORM | Prisma 6 |
| Autenticación | Auth.js v5 (credenciales + bcrypt) |
| Validación | Zod 4 |
| Tests | Vitest |
