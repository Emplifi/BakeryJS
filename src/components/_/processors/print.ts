import { Box } from '../../../lib/bakeryjs/Box';
import { Message } from '../../../lib/bakeryjs/Message';

class Print extends Box<Message, Object> {
	meta = {
		requires: ['job','raw'],
		provides: [],
	};

	constructor(name: string) {
		super(name);
    }

	public process(input: any): Object {
		console.log({printBox: JSON.stringify(input)});
		return {printBox: JSON.stringify(input)};
	}
}

export default (name: string): Print => {
	return new Print(name);
};
