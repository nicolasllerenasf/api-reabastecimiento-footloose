# API Reabastecimiento - Footloose

API en NestJS encargada de procesar cargas masivas de archivos Excel para la logística inversa y reabastecimiento de tiendas. El objetivo principal es optimizar la carga de detalles de pedidos hacia SQL Server manejando inserciones por lotes para superar limitaciones nativas de la base de datos.

---

##  Instalación y Despliegue

### Requisitos previos
- Node.js (v18 recomendada)
- SQL Server (o conexión por VPN a la base de datos de test/producción)

### Variables de entorno (`.env`)
Debes crear un archivo `.env` en la raíz del proyecto (`api-reabastecimiento/`) basado en el `.env.example`.

Asegurarse de configurar correctamente los accesos a la base de datos principal (`SRVTESTBD`).


```env
DB_HOST=192.168.50.71
DB_PORT=1433
DB_USER=usuario_app
DB_PASS="password_con_caracteres#"
DB_NAME=bd_passarela
```

### Comandos de inicio

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar el servidor en desarrollo (Watch mode)
npm run start:dev

# 3. Compilar y levantar para producción
npm run build
npm run start:prod
```

---

## ⚙️ ¿Cómo funciona internamente?

El flujo actual está centrado en la carga del archivo Excel de Requerimientos (RQ).

### Endpoint de Carga Lógica Inversa
**POST** `/api/replenishment/upload/:idPedido`

Este endpoint recibe un archivo `.xlsx` (multipart/form-data) mediante el campo `file` y un parámetro de ruta `:idPedido` que representa a la cabecera del pedido (tabla `tb_pedidos_logistica_inversa_cab`) a donde se va a atar todo el detalle.

**Proceso paso a paso:**
1. **Validación del Excel:** El servicio busca específicamente la pestaña que se llame `"RQ"`. Transforma la hoja en JSON respetando los tipos de celda.
2. **Limpieza de Data:** Ignora las primeras 8 filas de cabecera (empieza a leer desde la 9). Descarta filas sin tienda origen, sin SKU o con cantidad cero. Adicionalmente tiene un utilitario que limpia los números de SKU que Excel a veces formatea como `11010000001.0` o notación científica.
3. **Mapeo de zonas y Configuración:** Consulta a `ALMACEN` para agrupar por tienda origen y su zona, cruzándolo luego con la configuración de días máximos en `config_pedidos_logistica_inversa`. Todo esto se hace extrayendo las listas únicas y usando un `IN (...)` para evitar exceso de queries.
4. **Cálculo de Stock:** Trae el stock de `ALMACENPRODUCTOSTOCK` validando por la tienda (`fox_nombre`) y el SKU. *Nota técnica: No se le hace `LTRIM/RTRIM` a la DB directamente en el `WHERE` para no romper el performance y dejar que cruce por índices, se cruza la cadena exacta.* También traemos agrupado con `SUM` para consolidar el stock real.
5. **Inserción masiva en Batch:** SQL Server soporta un máximo estricto de 2100 parámetros por query. Como cada fila a insertar tiene 8 columnas, estamos insertando en lotes (`chunk` / `batchSize`) de **200 registros** a la vez para no rebasar ese límite (200 * 8 = 1600 parámetros). Así que podemos subir Excels de 20 mil filas y el proceso lo aguanta sin pestañear.
6. **Actualización de fecha máxima cabecera:** Usando los días de tránsito de la tabla de configuración para las tiendas involucradas, agarramos el día máximo y hacemos un `DATEADD` a la cabecera del pedido. Todo esto corre dentro una única **Transacción de base de datos (`QueryRunner`)**; si un batch falla, se revierte todo.

### Ejemplo de Response
Si todo es válido, retorna:
```json
{
  "success": true,
  "message": "Detalle de pedido cargado correctamente",
  "registrosProcesados": 2147,
  "diasCalculados": 30
}
```

---

##  Stack Tecnológico
- **Framework:** NestJS
- **ORM:** TypeORM
- **Procesamiento Excel:** libreria `xlsx` (SheetJS)
- **Base de Datos:** SQL Server (`mssql`)

## Elaborado por:
Nicolas Llerena
