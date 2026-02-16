import {Toast} from "primereact/toast";
import React, {useEffect, useRef, useState} from 'react';
import './App.css';
import useLoadContextValue from "./hooks/useLoadContextValue";
import {ViewerManager} from "./modules/viewer-api/viewer-manager";
import appContext from "./stores/store-context";
import ViewerContext from './stores/viewer-context';
import {GeneralStore} from "./stores/general-store";

function App() {
  const toast = useRef<any>(null);
  const viewerDivRef = useRef<HTMLDivElement>(null);
  const [generalStore] = useState(new GeneralStore());
  const isViewerCreated = useRef(false);
  const [viewer, setViewer] = useState<ViewerManager | undefined>(undefined);
  const viewerContextVal = useLoadContextValue(viewer || ({} as any), toast);
  
  useEffect(() => {
    if (viewerDivRef.current && !isViewerCreated.current && !viewer) {
      const container = viewerDivRef.current;
      const newViewer = new ViewerManager(container,toast);
      setViewer(newViewer);
      isViewerCreated.current = true;
    }
  }, [viewer]);

  useEffect(() => {

    if (!viewer)  return
    viewer.eventEmitter.on("building:updated", (args: any) => {
      generalStore.setTestElement(args ?? null)
      if (!args) {
        return
      }
      if (args[args.length - 1]?.isError?.hasError) {
        viewerContextVal.toast.current?.show({
          severity: 'error',
          summary: 'Model Validation',
          detail: args[args.length - 1].isError.errorMessage,
          life: 4000
        });
      }
    })
    return () => {
      viewer.eventEmitter.off("building:updated",()=>console.log('event unsubscribed'))
    }
  }, [generalStore]);
  
  return (
      <appContext.Provider value={{generalStore}}>
    <ViewerContext.Provider value={{...(viewerContextVal as any)}}>
      <Toast className="toast-element" ref={toast} position="bottom-center"/>
      <div id="viewerDivRef" className="viewerDivRef" ref={viewerDivRef}/>
    </ViewerContext.Provider>
      </appContext.Provider>
  );
}

export default App;
