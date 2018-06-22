import { Flow } from "./Flow";
import { Job } from "./Job";

export class Program {
    public run(flow:Flow) {

        console.log("Program run ----->")

        flow.process(new Job())

        //setTimeout(()=>flow.process(new Job()),2000)

    }
}