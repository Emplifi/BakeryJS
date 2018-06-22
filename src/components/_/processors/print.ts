import { Box } from '../../../lib/bakeryjs/Box';
import { Message } from '../../../lib/bakeryjs/Message';

class Print extends Box<Message, Object> {
	private symbols:Array<string>;
	meta = {
		requires: ['job','raw'],
		provides: [],
	};

	constructor(name: string) {
		super(name);
		this.symbols = [];
    }

	public process(input: any): Object {
		console.log({printBox: JSON.stringify(input)});
		return {printBox: JSON.stringify(input)};
	}
}

export default (name: string): Print => {
	return new Print(name);
};
