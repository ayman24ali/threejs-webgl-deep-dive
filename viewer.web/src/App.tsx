import {Toast} from "primereact/toast";
import React, {useEffect, useRef, useState} from 'react';
import './App.css';
import useLoadContextValue from "./hooks/useLoadContextValue";
import {ViewerManager} from "./modules/viewer-api/viewer-manager";
import appContext from "./stores/store-context";
import ViewerContext from './stores/viewer-context';
import {GeneralStore} from "./stores/general-store";

// ─────────────────────────────────────────────────────────────────────────────
// App — root React component.
//
// Responsibilities:
//   1. Mount the Three.js ViewerManager once the container <div> is in the DOM.
//   2. Guard against double-initialisation (React 18 StrictMode fires effects twice).
//   3. Subscribe to viewer events and forward them to the MobX store.
//   4. Provide the store and viewer instance to the component tree via contexts.
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const toast = useRef<any>(null);

  // viewerDivRef — the DOM element Three.js will append its <canvas> to.
  // Must be a ref (not state) so changing it doesn't trigger re-renders.
  const viewerDivRef = useRef<HTMLDivElement>(null);

  // MobX store instance — stable for the component's lifetime.
  const [generalStore] = useState(new GeneralStore());

  // isViewerCreated — a ref (not state) so it doesn't cause re-renders.
  // Guards against React StrictMode double-invocation of useEffect in development,
  // which would create two WebGL contexts and append two <canvas> elements.
  const isViewerCreated = useRef(false);

  const [viewer, setViewer] = useState<ViewerManager | undefined>(undefined);

  // useLoadContextValue bridges the ViewerManager instance into a React context
  // value object, re-building it whenever viewer or toast changes.
  const viewerContextVal = useLoadContextValue(viewer || ({} as any), toast);
  
  useEffect(() => {
    // Create the ViewerManager once the container div is mounted and only once.
    if (viewerDivRef.current && !isViewerCreated.current && !viewer) {
      const container = viewerDivRef.current;
      const newViewer = new ViewerManager(container, toast);
      setViewer(newViewer);
      isViewerCreated.current = true;
    }
  }, [viewer]);

  useEffect(() => {
    if (!viewer) return;

    // Subscribe to viewer events and update the MobX store.
    // The store mutation triggers reactive re-renders in any observer components.
    viewer.eventEmitter.on("building:updated", (args: any) => {
      generalStore.setTestElement(args ?? null)
      if (!args) return;

      // Show a PrimeReact toast notification when the viewer emits a validation error.
      if (args[args.length - 1]?.isError?.hasError) {
        viewerContextVal.toast.current?.show({
          severity: 'error',
          summary: 'Model Validation',
          detail: args[args.length - 1].isError.errorMessage,
          life: 4000
        });
      }
    })

    // Cleanup: unsubscribe the listener when the component unmounts or
    // when generalStore changes, preventing stale-closure memory leaks.
    return () => {
      viewer.eventEmitter.off("building:updated", () => console.log('event unsubscribed'))
    }
  }, [generalStore]);
  
  return (
    // appContext.Provider — makes MobX stores accessible anywhere in the tree via useContext(appContext).
    <appContext.Provider value={{ generalStore }}>
      {/* ViewerContext.Provider — makes the ViewerManager instance available to child components. */}
      <ViewerContext.Provider value={{ ...(viewerContextVal as any) }}>
        <Toast className="toast-element" ref={toast} position="bottom-center"/>
        {/* This div is the mount point for the Three.js WebGL canvas. */}
        <div id="viewerDivRef" className="viewerDivRef" ref={viewerDivRef}/>
      </ViewerContext.Provider>
    </appContext.Provider>
  );
}

export default App;
