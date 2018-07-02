import { Box } from '../../../lib/bakeryjs/Box';
import {MessageData} from '../../../lib/bakeryjs/Message';

class Print extends Box<MessageData, MessageData> {
	meta = {
		requires: ['job','raw'],
		provides: [],
	};
    private readonly logger: {log: (message: any) => void};

	constructor(name: string, logger: {log: (message: any) => void}) {
		super(name);
        this.logger = logger;
    }

	public process(input: MessageData): MessageData {
		this.logger.log({printBox: JSON.stringify(input)});
		return {printBox: JSON.stringify(input)};
	}
}

export default (name: string, services: {[key: string]: any}): Print => {
	return new Print(name, services.logger);
};
