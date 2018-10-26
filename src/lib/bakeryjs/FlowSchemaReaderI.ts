import {FlowExplicitDescription} from './FlowBuilderI';

export default interface FlowSchemaReaderI {
	getFlowSchema(
		name: string
	): Promise<FlowExplicitDescription> | FlowExplicitDescription;
}
