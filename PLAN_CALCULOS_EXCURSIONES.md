# Plan: Sistema de 2 Variantes de Cálculo de Saldos - Dijous d'Excursió

## Objetivo
Implementar 2 métodos de cálculo de saldos de kilómetros para poder comparar. Cada excursión guardará los subtotales de los 2 métodos.

---

## 2 Tipos de Cálculo

### **Variante 1: Deuta de Quilòmetres (Actual)**
Modelo matemáticamente justo por km y pasajeros.

**Fórmula:**
- **Conductor:** `-(km × nº_pasajeros)` → lo que "regala"
- **Pasajero:** `+km` → lo que "recibe"
- **No participant:** `0`

**Interpretación:**
- `Saldo > 0`: ha viajado sin conducir → debe poner coche
- `Saldo < 0`: ha conducido más → ya ha pagado
- `Saldo = 0`: equilibrado

**Ejemplo (100 km, 4 personas: 1 conductor + 3 pasajeros):**
- Juan (conductor): `-100 × 3 = -300`
- Ana, Luis, Tú (pasajeros): `+100` cada uno
- Total: 0 ✓

**Con conductor esporádico:**
- Restar del total de pasajeros los que lleva el conductor esporádico
- Ejemplo: conductor esporádico lleva 2 pasajeros → pasajeros contabilizados = 3 - 2 = 1
- Juan (conductor registrado): `-100 × 1 = -100`

---

### **Variante 2: Consumo de Plazas**
Basada en lo que cada persona "consume" y lo que el conductor "aporta".

**Fórmula:**
- **Conductor:** `-(km × nº_pasajeros_sin_esporádicos)` → lo que aporta
- **Pasajero:** `+km` → lo que consume
- **No participant:** `0`

**Interpretación:** Negativo = debe coche, Positivo = le deben

**Ejemplo (100 km, 1 conductor + 3 pasajeros):**
- Juan (conductor): `-100 × 3 = -300`
- Ana, Luis, Tú (pasajeros): `+100` cada uno
- Total: 0 ✓

**Con conductor esporádico:**
- Conductor registrado: `-km × (nº_pasajeros - pasajeros_conductor_esporádico)`
- Ejemplo: conductor esporádico lleva 2 pasajeros → 
  - Juan (conductor registrado): `-100 × (3 - 2) = -100`

---

## Plan de Implementación

### 1. Migración de Base de Datos
Agregar 2 campos JSONB a tabla `grup_excursions`:
```sql
ALTER TABLE public.grup_excursions ADD COLUMN IF NOT EXISTS subtotal_variant1 jsonb DEFAULT NULL;
ALTER TABLE public.grup_excursions ADD COLUMN IF NOT EXISTS subtotal_variant2 jsonb DEFAULT NULL;
```

Estructura del JSONB:
```json
{
  "carlosm": -300,
  "carlosj": 100,
  "antonio": 100,
  ...
}
```

### 2. Funciones de Cálculo (en ExcursionsPage.jsx)
Crear 2 funciones de cálculo global y 2 de delta:
- `calcularSaldos_V1(excursions)` → saldos acumulados variante 1
- `calcularSaldos_V2(excursions)` → saldos acumulados variante 2
- `calcularDeltaV1(excursion)` → delta de esa excursión en V1
- `calcularDeltaV2(excursion)` → delta de esa excursión en V2

Cada función retorna: `{ usuario_id: saldo, ... }`

### 3. Lógica de Guardado
Al insertar/editar excursión:
1. Calcula los deltas (V1, V2) con el contexto de todas las excursiones
2. Guarda los 2 subtotales en los campos JSONB
3. Cuando se entra una excursión antigua, se recalcula automáticamente su delta

### 4. Dashboard - Modificaciones
**Pestaña "Resum" (existente):**
- Agregar botón radio para seleccionar variante: `[ ○ V1 | ○ V2 ]`
- Los saldos mostrados cambiarán según selección
- Sugerencia de conductores se actualiza según variante activa

**Nueva pestaña "Comparativa":**
- Tabla con 2 columnas (V1, V2)
- Fila por usuario mostrando su saldo final en cada variante
- Sección evolció per sortida con deltas por excursión

**Nueva pestaña "Explicació":**
- Descripción visual de cada método
- Ejemplos paso a paso
- Diferencias conceptuales entre V1 y V2

### 5. Vistas a Implementar
1. **Dashboard (Resum):** selector variante (V1/V2) + saldos
2. **Comparativa:** tabla 2 columnas + evolció per sortida
3. **Explicació:** info de V1 y V2

---

## Notas Importantes
- Las excursiones se ordenan siempre por `data` (fecha de ocurrencia), nunca por `created_at`
- Cada excursión guarda su **delta** (cambio) en los 2 subtotales, no saldos cumulativos
  - V1/V2: cambio por conductor y pasajeros de esa excursión
  - Pasajeros divididos equitativamente entre conductores
- El conductor esporádico no puntúa pero sus pasajeros se restan del total
- Al editar una excursión, se recalcula automáticamente su delta

---

## Estado de Implementación
- [x] Migración BD (agregar 2 campos JSONB para subtotales)
- [x] Función calcularSaldos_V1, V2 (para dashboard global)
- [x] Funciones calcularDeltaV1, V2 (para deltas por excursión)
- [x] Función calcularSubtotalesParaExcursion (contexto + delta)
- [x] Lógica de guardado (guardar 2 deltas por excursión)
- [x] Pasajeros divididos equitativamente entre conductores
- [x] Dashboard: selector variante (V1/V2)
- [x] Pestaña "Comparativa" con tabla 2 columnas + evolció per sortida
- [x] Pestaña "Explicació" con V1 y V2
- [x] Aplicar migración BD en Supabase
- [x] Fixes de contraste en UI
- [x] Eliminar Variante 3 (ratio de asistencia)
- [x] Build de producción (`npm run build`)

**✓ Implementación completada**

