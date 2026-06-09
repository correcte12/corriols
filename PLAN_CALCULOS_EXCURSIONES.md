# Plan: Sistema de 3 Variantes de Cálculo de Saldos - Dijous d'Excursió

## Objetivo
Implementar 3 métodos de cálculo de saldos de kilómetros para poder comparar y evaluar cuál es más justo. Cada excursión guardará los subtotales de los 3 métodos.

---

## 3 Tipos de Cálculo

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

### **Variante 3: Consumo de Plazas + Ratio de Asistencia**
Variante 2 ajustada por asistencia. Penaliza (o equilibra) a quienes asisten esporádicamente.

**Fórmula:**
1. Calcular saldos con **Variante 2**
2. Calcular ratio de asistencia: `ratio = asistencias / total_excursiones`
3. Calcular factor multiplicador: `factor = (100 - (ratio × 100)) / 100`
4. **Saldo final:** `saldo_v2 × factor`

**Interpretación:** A menor asistencia, mayor multiplicador del saldo.

**Ejemplo:**
- Total de excursiones: 20
- Tú has asistido: 15
- Ratio: 15/20 = 0.75 (75%)
- Factor: (100 - 75) / 100 = 0.25
- Si tu saldo en V2 es +200 → en V3 = 200 × 0.25 = +50

**Ventaja:** Evita que quienes asisten siempre tengan saldos muy altos/bajos.

---

## Plan de Implementación

### 1. Migración de Base de Datos
Agregar 3 campos JSONB a tabla `grup_excursions`:
```sql
ALTER TABLE public.grup_excursions ADD COLUMN IF NOT EXISTS subtotal_variant1 jsonb DEFAULT NULL;
ALTER TABLE public.grup_excursions ADD COLUMN IF NOT EXISTS subtotal_variant2 jsonb DEFAULT NULL;
ALTER TABLE public.grup_excursions ADD COLUMN IF NOT EXISTS subtotal_variant3 jsonb DEFAULT NULL;
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
Crear 3 funciones independientes:
- `calcularSaldos_V1(excursions)` → saldos variante 1
- `calcularSaldos_V2(excursions)` → saldos variante 2
- `calcularSaldos_V3(excursions)` → saldos variante 3 (usa V2 + ratio)

Cada función retorna: `{ usuario_id: saldo, ... }`

### 3. Lógica de Guardado
Al insertar/editar excursión:
1. Calcula todos los saldos (V1, V2, V3) con todas las excursiones existentes + la nueva
2. Guarda los 3 subtotales en los campos JSONB
3. Cuando se entra una excursión antigua, recalcula automáticamente desde esa fecha

### 4. Dashboard - Modificaciones
**Pestaña "Resum" (existente):**
- Agregar botón radio para seleccionar variante: `[ ○ V1 | ○ V2 | ○ V3 ]`
- Los saldos mostrados cambiarán según selección
- Sugerencia de conductores se actualiza según variante activa
- Mantener historial de últimas 5 excursiones

**Nueva pestaña "Comparativa":**
- Tabla con 3 columnas (V1, V2, V3)
- Fila por usuario mostrando su saldo final en cada variante
- Opcionalmente: tabla adicional excursión por excursión

**Nueva pestaña "Explicació":**
- Descripción visual de cada método
- Ejemplos paso a paso
- Cuándo usar cada uno
- FAQ

### 5. Vistas a Implementar
1. **Dashboard (Resum):** botón radio + saldos por variante
2. **Comparativa:** tabla 3 columnas
3. **Explicació:** info + ejemplos

---

## Notas Importantes
- Variante 3 siempre se calcula **sobre Variante 2**, no sobre V1
- Las excursiones se ordenan siempre por `data` (fecha de ocurrencia), nunca por `created_at`
- Al editar una excursión antigua, se recalculan automáticamente todos los subtotales posteriores
- El conductor esporádico afecta a V1 y V2 de la misma forma

---

## Estado de Implementación
- [x] Migración BD (agregar 3 campos JSONB)
- [x] Función calcularSaldos_V1
- [x] Función calcularSaldos_V2
- [x] Función calcularSaldos_V3
- [x] Lógica de guardado (guardar 3 subtotales)
- [x] Dashboard: botón radio para seleccionar variante
- [x] Pestaña "Comparativa"
- [x] Pestaña "Explicació"
- [x] Aplicar migración BD en Supabase (ejecutado: `supabase db push`)
- [x] Fixes de contraste en UI (header tabla, selector variante)
- [ ] Actualizar excursiones existentes (editarlas para recalcular subtotales)
- [ ] Testing con datos reales del Excel

**Nota:** Las excursiones existentes antes de la migración no tienen subtotales. Al editar cada una, se recalcularán automáticamente los 3 métodos.

