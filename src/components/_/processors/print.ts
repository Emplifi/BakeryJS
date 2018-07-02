import { Box } from '../../../lib/bakeryjs/Box';
import {MessageData} from '../../../lib/bakeryjs/Message';

class Print extends Box<MessageData, MessageData> {
	meta = {
		requires: ['job','raw'],
		provides: [],
	};

	constructor(name: string) {
		super(name);
    }

	public process(input: MessageData): MessageData {
		console.log({printBox: JSON.stringify(input)});
		return {printBox: JSON.stringify(input)};
	}
}

export default (name: string): Print => {
	return new Print(name);
};
