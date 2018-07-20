import {IPriorityQueue} from './queue/IPriorityQueue';
import {Job} from './Job';
import {DataMessage, Message} from './Message';

/**
 * We have Boxes set up properly, now we have to interconnect them to the workflow.
 * There will be probably more interpretations of the workflow network.  Currently,
 * we have these two in mind:
 *
 * 1. TODO: (idea1) (polish example) Parallel/Serial waterfall of commands, e.g.
 *   a. Take a Job and push it into Box A.
 *   b. the messages from A push into boxes B and C -- each processes the Messagese independently on the other.
 *      The contributions of the both Boxes to single Message is merged again into the single respective Message.
 *   c. Once both B and C are ready, take the Messages and push it into other Boxes D, E, F.
 *   d. The flow  of merged Messages out of D, E, F is a result and is passed into output of the flow.
 *
 * 2. Assembly lines in a factory, e.g.
 *   a. Take a Job and push it into Box A.
 *   b. Each message generated in A enteres Boxes B and C.
 *   c. The merged output of B and C enters D.  In the same time, the output from C enters E.
 *   d. Outputs from D and E enters F, moreover, output from D enters G.
 *   e. Flow of (merged) Messages from F and G is a result and is passed into output of the flow.
 *
 *   The flow must ensure that the input Job goes through all Boxes respecting dependencies.
 *
 * The Boxes (partially) ordered by its dependencies form generally a DAG (directed acyclic graph).
 * The Flow is the mechanism that lives on the edges of the DAG.  Its job is to move the Messages along the edges.
 * This is common to all various implementations of the Flow.
 *
 * The implementations may vary in the details, how the transfer of Messages is performed.
 * The edge can be an eager queue, that invokes the target Box as soon as possible since a Message has entered it.
 * Or the edge can be a "dispenser" that handles you a Message every time you ask for it.  Or the edge may have implemented
 * prioritization.
 *
 *  **The job of the Flow is: Given the Boxes and their settings, create the piping around them respecting their dependencies (requirements, provisions)
 * and the abilities (mapping, generation, aggregation).**
 *
 * TODO: (idea2) The flow has to track the (partial) order a Message is going through Boxes.  It will be needed for debugging
 *  the flows under development.  The mechanism for storage and report of these Trace -may be implemented in Message.- api available
 *  set up in Programm (used by the flow executor) --- e.g. opentracing/opentracing-javascript
 *
 * - ToDo: (idea2) The Flow must handle unhandled exceptions of the Boxes. Each flow on its own,
 or some common layer/wrapper/applicator?
 * - ToDo: (idea2) The Flow may have a finalization stage, that returns some aggregated document/statistics + flags (all Boxes OK, Box A error for 5% Messages)  of all the output messages?
 *   Pro vystup do fronty/db/response/api krabicku.  Message ktera opousti krabicku a neni navazana na dalsi, *vstupuje do drainu*.
 *   Jak se to bude chovat, kdyz zustanou viset dve vetve s ruznou dimenzi?
 *
 * - Todo: (idea2) How the Flow realizes the input and the output? Queues? OK
 * - ToDo: (idea2) The Flow provides performance/monitoring metrics of the DAG edges? OK
 */
export class Flow {
	private queue: IPriorityQueue<Message>;

	public constructor(queue: IPriorityQueue<Message>) {
		this.queue = queue;
	}

	public process(job: Job): void {
		const message = new DataMessage(job);
		this.queue.push(message,  1);
	}
}
