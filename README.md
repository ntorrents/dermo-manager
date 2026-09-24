# DermoManager — ERP de Gestión para Clínicas Estéticas y Dermatológicas

DermoManager es una plataforma de planificación de recursos empresariales (ERP) y gestión de relaciones con clientes (CRM) de nivel profesional, diseñada específicamente para clínicas dermatológicas, estéticas y de bienestar. El sistema permite administrar todo el flujo operativo: desde la programación de citas, control de inventario por lotes y firma de consentimientos informados, hasta la facturación, contabilidad y análisis financiero detallado.

---

## 🛠️ Stack Tecnológico
- **Frontend:** React + Vite, Tailwind CSS (estética premium y minimalista).
- **Gestión de Estado y Datos:** React Query (`@tanstack/react-query`) para caché y sincronización en tiempo real.
- **Backend:** Supabase (PostgreSQL) con Políticas de Seguridad a Nivel de Fila (RLS) para aislamiento multi-inquilino (multi-tenant).
- **Iconografía:** Lucide React.
- **Exportaciones:** Generación de PDF (jsPDF) y Excel (xlsx).

---

## 📁 Estructura del Proyecto
- `src/components/`: Componentes organizados por módulos de negocio (Clientes, Finanzas, Inventario, etc.).
- `src/hooks/`: Custom hooks de React Query para mutaciones y consultas eficientes con Supabase.
- `src/context/`: Contextos globales (ej. `TenantContext` para multi-clínica).
- `src/services/`: Configuración y cliente de Supabase.
- `supabase/migrations/`: Migraciones estructuradas de base de datos SQL.

---

## 🚀 Características y Módulos Funcionales

### 1. 🏠 Inicio (Dashboard de Bienvenida)
- Saludo personalizado según la hora del día.
- Resumen operativo diario (citas agendadas para hoy, clientes activos).
- Accesos rápidos a los módulos más frecuentados del sistema.

### 2. 📊 Dashboard Analítico
- Indicadores Clave de Rendimiento (KPIs) financieros y de volumen.
- Visualización de ingresos, gastos y márgenes de beneficio del período seleccionado.
- Métricas sobre servicios más solicitados y flujo de pacientes.

### 3. 👥 Gestión de Clientes (CRM Clínico)
- **Ficha Integral del Paciente:** Información personal, de facturación (B2C/B2B) e identificación (DNI/CIF).
- **Seguimiento de Estados:** Clasificación de clientes según su estado operativo (`Activo`, `Inactivo`, `Bloqueado`, `Borrador / Lead`).
- **Historial y Línea de Tiempo:** Registro unificado de consultas, sesiones de tratamiento realizadas, facturas y notas de evolución.
- **Antes y Después (Fotos de Sesiones):** Subida, almacenamiento y visualización cronológica de imágenes de evolución por sesión.
- **Documentación Personalizada:** Almacenamiento e integración con carpetas externas (ej. Google Drive).

### 4. 📅 Agenda y Gestión de Citas
- Calendario interactivo para la programación de consultas y tratamientos.
- Control de estados de cita (Programada, Realizada, Cancelada).
- Filtros rápidos por tratamientos y médicos encargados.
- Notificaciones de seguimiento clínico post-tratamiento.

### 5. 💉 Tratamientos y Servicios
- Catálogo paramétrico de servicios médicos y estéticos.
- Clasificación por categorías o grupos de tratamiento.
- Configuración de precios, impuestos aplicables e IVA.

### 6. 🎟️ Gestión de Bonos
- Creación y venta de paquetes de sesiones de tratamiento.
- Control automatizado del saldo de sesiones restantes por cada cliente.
- Historial detallado de consumo de bonos en cada cita.

### 7. 📄 Consentimientos Informados y Firmas
- Plantillas de consentimiento clínico predefinidas por tratamiento.
- Firmador digital integrado para que el paciente firme directamente en tablet o dispositivo móvil.
- Almacenamiento seguro de los consentimientos firmados vinculados a la ficha del cliente.

### 8. 📝 Presupuestos
- Creación de propuestas comerciales personalizadas y presupuestos de tratamiento multi-línea.
- Control de estados (Borrador, Enviado, Aceptado, Rechazado).
- Conversión sencilla de presupuestos aceptados en tratamientos activos.

### 9. 📦 Control de Inventario y Stock
- Catálogo de productos cosméticos y médicos.
- **Gestión por Lotes:** Control de trazabilidad con fechas de caducidad y números de lote.
- **Mutaciones de Stock:** Registro de entradas de proveedor, mermas, consumo en tratamientos y ventas directas.
- Alertas de stock mínimo para evitar roturas de inventario.

### 10. 💶 Finanzas y Facturación
- **Movimientos de Caja:** Registro clasificado de ingresos y gastos operativos de la clínica.
- **Facturación:** Generación de facturas completas o simplificadas con cálculo automático de bases, IVA y retenciones de IRPF. Exportación a PDF.
- **Proveedores:** Directorio de proveedores, registro de compras y control de facturas de gasto.
- **Análisis Financiero:** Informes detallados de flujo de caja, balance de pérdidas y ganancias.

### 11. ⚖️ Fiscalidad y Activos
- **Cálculo de Impuestos:** Estimación de declaraciones trimestrales/anuales de IVA y retenciones de IRPF.
- **Bienes de Inversión:** Registro de activos fijos amortizables de la clínica y cálculo automático de cuotas de amortización prorrateadas.

---

## 🔒 Seguridad y Privacidad
El ERP implementa seguridad multi-inquilino (multi-tenant) a través de políticas RLS (Row Level Security) en Supabase:
- Cada clínica accede exclusivamente a sus propios clientes, facturas, citas e inventarios.
- Control de acceso basado en roles para delimitar acciones de personal administrativo, médico y administradores de clínica.
