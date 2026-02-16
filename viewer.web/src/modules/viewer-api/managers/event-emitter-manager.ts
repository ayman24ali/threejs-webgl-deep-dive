
type EventCallback<T> = (payload: T) => void;

type BuildingEventMap = {
    "building:updated": { key: any; value: any; building: any };
    "building:loaded": { building: any };
    "building:error": { error: Error };
};

export class EventEmitterManager {
    private listeners = new Map<string, Set<EventCallback<any>>>();
    constructor() {
    }

    on<K extends keyof BuildingEventMap>(
        event: K,
        callback: EventCallback<BuildingEventMap[K]>
    ) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);

        // Return unsubscribe function for cleanup
        return () => this.off(event, callback);
    }

    off<K extends keyof BuildingEventMap>(
        event: K,
        callback: EventCallback<BuildingEventMap[K]>
    ) {
        this.listeners.get(event)?.delete(callback);
    }

    emit<K extends keyof BuildingEventMap>(
        event: K,
        payload: BuildingEventMap[K]
    ) {
        this.listeners.get(event)?.forEach((cb) => cb(payload));
    }

}