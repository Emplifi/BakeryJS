import {Box} from '../../../lib/bakeryjs/Box';
import {MessageData} from '../../../lib/bakeryjs/Message';
import {ServiceProvider} from '../../../lib/bakeryjs/ServiceProvider';

class Print extends Box {
	private readonly logger: {log: (message: any) => void};

	public constructor(name: string, logger: {log: (message: any) => void}) {
		super(name, {
			requires: ['jobId', 'raw'],
			provides: [],
			emits: [],
			aggregates: false
		});
		this.logger = logger;
	}

	protected processValue(input: MessageData): MessageData {
		this.logger.log({printBox: JSON.stringify(input)});
		return {};
	}
}

export default (name: string, serviceProvider: ServiceProvider): Print => {
	return new Print(name, serviceProvider.get('logger'));
};
