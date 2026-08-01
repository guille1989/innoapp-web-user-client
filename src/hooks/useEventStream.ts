import { useEffect, useRef, useState } from "react";
import { genEvent } from "../data/mockEvents";
import type { BusinessEvent } from "../types";

const STREAM_INTERVAL_MS = 2600;
const MAX_EVENTS = 300;
const SEED_COUNT = 9;

export function useEventStream() {
  const [events, setEvents] = useState<BusinessEvent[]>(() => {
    const seeded: BusinessEvent[] = [];
    for (let i = 0; i < SEED_COUNT; i++) {
      const e = genEvent();
      e.ts -= (SEED_COUNT - i) * STREAM_INTERVAL_MS;
      seeded.push(e);
    }
    return seeded;
  });
  const latestIdRef = useRef<number | null>(events.length ? events[events.length - 1].id : null);

  useEffect(() => {
    const timer = setInterval(() => {
      setEvents((prev) => {
        const e = genEvent();
        latestIdRef.current = e.id;
        const next = [...prev, e];
        return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
      });
    }, STREAM_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return { events, latestEventId: latestIdRef.current };
}
