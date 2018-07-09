import { Box } from '../../../lib/bakeryjs/Box';
import {MessageData} from '../../../lib/bakeryjs/Message';
import {ServiceProvider} from '../../../lib/bakeryjs/ServiceProvider';

class Print extends Box<MessageData, MessageData, MessageData> {
	meta = {
		requires: ['job','raw'],
		provides: [],
	};
    private readonly logger: {log: (message: any) => void};

	constructor(name: string, logger: {log: (message: any) => void}) {
		super(name);
        this.logger = logger;
    }

	protected processValue(input: MessageData): MessageData {
		this.logger.log({printBox: JSON.stringify(input)});
		return {printBox: JSON.stringify(input)};
	}
}

export default (name: string, serviceProvider: ServiceProvider): Print => {
	return new Print(name, serviceProvider.get('logger'));
};
