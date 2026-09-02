-- Numeración de comprobantes a prueba de concurrencia.
--
-- Calcular el número con MAX(saleNumber) + 1 permitiría que dos ventas
-- simultáneas obtuvieran el mismo comprobante. Una secuencia de PostgreSQL
-- entrega valores únicos aunque haya escrituras en paralelo.
--
-- Las secuencias no se revierten al abortar una transacción, de modo que puede
-- haber huecos en la numeración. Es el comportamiento correcto: para un
-- comprobante interno un hueco es inofensivo, un duplicado no.

CREATE SEQUENCE IF NOT EXISTS sale_number_seq AS bigint START WITH 1 INCREMENT BY 1;

CREATE SEQUENCE IF NOT EXISTS purchase_number_seq AS bigint START WITH 1 INCREMENT BY 1;
