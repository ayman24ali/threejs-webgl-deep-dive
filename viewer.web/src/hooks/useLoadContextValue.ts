import {useEffect, useState} from "react";
import {ViewerManager} from "../modules/viewer-api/viewer-manager";

// ─────────────────────────────────────────────────────────────────────────────
// useLoadContextValue — custom hook that bridges an imperative ViewerManager
// instance and the PrimeReact toast ref into a plain React context value object.
//
// Why a separate hook?
//   The ViewerManager is created imperatively (outside of the React render cycle)
//   but child components need access to it via context.  This hook watches for
//   the viewer/toast to become available and constructs the context payload,
//   keeping App.tsx clean and the context assembly logic reusable/testable.
// ─────────────────────────────────────────────────────────────────────────────
export default function useLoadContextValue(viewer: ViewerManager, toast: any): any {
  // Start with an empty object so consumers get a stable (though incomplete)
  // reference before the viewer is ready.
  const [viewerContextVal, setViewerContextVal] = useState({});
  
  useEffect(() => {
    // Re-build the context value whenever viewer or toast changes.
    if (viewer)
      setViewerContextVal({
        toast,
        manager: viewer
      } as any);
  }, [toast, viewer]);
  
  return viewerContextVal;
}
