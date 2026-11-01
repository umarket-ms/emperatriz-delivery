import { useEffect, useMemo, useState } from "react";
import { DeliveryItemAdapter } from "@/interfaces/delivery/deliveryAdapters";
import { IDeliveryStatus } from "@/interfaces/delivery/deliveryStatus";

/** Cada cuánto se refresca el countdown del panel de programadas. */
const COUNTDOWN_TICK_MS = 30_000;

/** Formatea una fecha ISO como "dd/mm hh:mm AM/PM" (sin depender de Intl). */
export function formatScheduledDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day}/${month} ${hours}:${minutes} ${ampm}`;
}

/**
 * Countdown hasta la hora programada.
 * - Futuro:  "en 1h 22m" / "en 45min" / "en menos de 1 min"
 * - Cumplida: "Hora cumplida" (el cron la libera en <= 5 min)
 */
export function formatCountdown(scheduledAt: string, nowMs: number): string {
  const target = new Date(scheduledAt).getTime();
  if (Number.isNaN(target)) return "";
  const diffMs = target - nowMs;
  if (diffMs <= 0) return "Hora cumplida — liberando…";
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `en ${hours}h ${minutes}m`;
  if (minutes > 0) return `en ${minutes}min`;
  return "en menos de 1 min";
}

export interface ScheduledDeliveryItem {
  delivery: DeliveryItemAdapter;
  scheduledAt: string | null;
  formattedHour: string | null;
  countdown: string;
  isDue: boolean;
}

/**
 * Entregas del repartidor en estado "programado" (hora pactada con el cliente),
 * ordenadas por hora ascendente, con countdown vivo.
 *
 * Estas entregas NO forman parte de la ruta activa (se excluyen del mapa);
 * se reactivan automáticamente vía cron a su hora y reaparecen en la ruta.
 */
export function useScheduledDeliveries(
  allDeliveries: DeliveryItemAdapter[] | null | undefined,
): { scheduledDeliveries: ScheduledDeliveryItem[]; nowMs: number } {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const scheduledDeliveries = useMemo<ScheduledDeliveryItem[]>(() => {
    if (!allDeliveries || allDeliveries.length === 0) return [];
    return allDeliveries
      .filter(
        (d): d is DeliveryItemAdapter =>
          !!d && d.deliveryStatus?.title === IDeliveryStatus.SCHEDULED,
      )
      .map((delivery) => {
        const scheduledAt = delivery.scheduledAt ?? null;
        const targetMs = scheduledAt ? new Date(scheduledAt).getTime() : NaN;
        return {
          delivery,
          scheduledAt,
          formattedHour: formatScheduledDateTime(scheduledAt),
          countdown: scheduledAt ? formatCountdown(scheduledAt, nowMs) : "",
          isDue: !Number.isNaN(targetMs) && targetMs - nowMs <= 0,
        };
      })
      .sort((a, b) => {
        const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      });
  }, [allDeliveries, nowMs]);

  return { scheduledDeliveries, nowMs };
}
