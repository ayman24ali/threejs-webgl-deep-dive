import {makeAutoObservable} from "mobx";

// ─────────────────────────────────────────────────────────────────────────────
// GeneralStore — MobX reactive state container.
//
// Key concept: makeAutoObservable
//   Calling makeAutoObservable(this) in the constructor instruments the class
//   automatically:
//     • Properties  → observable  (MobX tracks reads and writes)
//     • Methods     → actions     (mutations are batched into a single reaction)
//     • Getters     → computed    (derived values are memoized)
//
//   Any MobX observer component that reads testElement will automatically
//   re-render when setTestElement() is called — no manual subscription needed.
// ─────────────────────────────────────────────────────────────────────────────
export class GeneralStore {
    // Observable property — changes here propagate to all MobX observer components.
    testElement: any;

    constructor() {
        makeAutoObservable(this);
    }

    // Action — MobX batches all observable mutations inside actions into a
    // single notification so observers only re-run once per action call.
    setTestElement(element: any) {
        this.testElement = element;
    }
}
