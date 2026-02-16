import { createContext } from "react"
import {GeneralStore} from "./general-store"

export type IStore = {
    generalStore: GeneralStore;
};
// Assuming IfcViewerStore is a class or a factory function for your store
const appContext = createContext<IStore>({
    generalStore: new GeneralStore(),
})

export default appContext;
