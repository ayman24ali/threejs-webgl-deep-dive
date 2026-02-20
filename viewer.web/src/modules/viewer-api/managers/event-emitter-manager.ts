
// ─────────────────────────────────────────────────────────────────────────────
// EventEmitterManager — a type-safe, generic pub/sub event bus.
//
// Key concepts:
//   • TypeScript mapped types & conditional types: BuildingEventMap ties each
//     event name string to its exact payload shape.  Generics constrained with
//     `K extends keyof BuildingEventMap` make on/off/emit compile-time safe —
//     wrong event names or mismatched payload types are caught as errors.
//
//   • Listener storage: Map<string, Set<callback>> — O(1) lookup by event name,
//     O(1) add/delete by callback reference.  Using Set prevents duplicate
//     registrations of the same callback.
//
//   • Unsubscribe pattern: on() returns a cleanup function `() => this.off(...)`.
//     This pairs cleanly with React's useEffect return value for teardown.
// ─────────────────────────────────────────────────────────────────────────────

type EventCallback<T> = (payload: T) => void;

// Defines the contract for every event the viewer can emit.
// Extending this map is the only change needed to add a new event type.
type BuildingEventMap = {
    "building:updated": { key: any; value: any; building: any };
    "building:loaded":  { building: any };
    "building:error":   { error: Error };
};

export class EventEmitterManager {
    // Internal store: event name → Set of callbacks registered for that event.
    private listeners = new Map<string, Set<EventCallback<any>>>();

    constructor() {
    }

    // Subscribe to an event.
    // K is constrained to valid event names; the callback payload type is inferred.
    // Returns an unsubscribe function — call it to clean up (e.g. in useEffect teardown).
    on<K extends keyof BuildingEventMap>(
        event: K,
        callback: EventCallback<BuildingEventMap[K]>
    ) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);

        // Return an unsubscribe function for clean React useEffect teardown:
        //   return () => viewer.eventEmitter.on("building:updated", handler);
        return () => this.off(event, callback);
    }

    // Unsubscribe a specific callback from an event.
    off<K extends keyof BuildingEventMap>(
        event: K,
        callback: EventCallback<BuildingEventMap[K]>
    ) {
        this.listeners.get(event)?.delete(callback);
    }

    // Fire an event, calling all registered callbacks with the typed payload.
    emit<K extends keyof BuildingEventMap>(
        event: K,
        payload: BuildingEventMap[K]
    ) {
        this.listeners.get(event)?.forEach((cb) => cb(payload));
    }

}