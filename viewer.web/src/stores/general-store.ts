import {makeAutoObservable} from "mobx";


export class GeneralStore {
    testElement:any;
    constructor() {
        makeAutoObservable(this);
    }
    setTestElement(element: any) {
        this.testElement = element;
    }
}
